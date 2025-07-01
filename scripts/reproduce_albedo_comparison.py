#!/usr/bin/env python3
"""
reproduce_albedo_comparison.py
================================
Re-creates the Ren-style comparison between daily MOD09GA / MOD10A1
albedo estimates and the MCD43A4 broadband albedo reference.

Rule enforced
-------------
When both Terra and Aqua observations exist for the same calendar day
for the same product family (MOD09GA or MOD10A1), **keep only the image
with the larger `pixel_count`**.

Usage
-----
$ python reproduce_albedo_comparison.py \
    --csv data/MOD09GA_MOD10A1_MCD43A4_Comparaison.csv \
    --out plots/

The script will:
1. Load the CSV into a pandas DataFrame.
2. Collapse Terra/Aqua duplicates using the rule above.
3. Compute overall bias, MAE, RMSE of the MOD09GA and MOD10A1 methods
   with respect to MCD43A4 (per-pixel) using the `albedo_mean` column.
4. Generate scatter plots and a 16-day running-mean time-series similar
   to those shown in Ren (2021).
"""


import argparse
from pathlib import Path

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# ----------------------------
# Helper functions
# ----------------------------


def method_family(method: str) -> str:
    """Map sensor-specific method names to product family.

    * MOD09GA / MYD09GA → "MOD09GA" (Ren daily albedo)
    * MOD10A1 / MYD10A1 → "MOD10A1" (snow-albedo daily)
    * everything else   → unchanged (e.g. MCD43A4)
    """
    if method in {"MOD09GA", "MYD09GA"}:
        return "MOD09GA"
    if method in {"MOD10A1", "MYD10A1"}:
        return "MOD10A1"
    return method


def collapse_terra_aqua(df: pd.DataFrame) -> pd.DataFrame:
    """Keep only the Terra **or** Aqua observation with more pixels.

    Parameters
    ----------
    df : DataFrame
        Must contain at least `date`, `method`, `pixel_count` columns.

    Returns
    -------
    DataFrame
        Same columns as input, with Terra/Aqua duplicates removed for
        MOD09GA and MOD10A1 families.
    """
    # Map family and sort so the *largest* pixel_count comes first.
    df = df.copy()
    df["family"] = df["method"].apply(method_family)
    df_sorted = df.sort_values("pixel_count", ascending=False)

    # For MOD09GA and MOD10A1 keep only the first (largest pixel_count)
    subset_fams = ["MOD09GA", "MOD10A1"]
    keep_mask = ~df_sorted["family"].isin(
        subset_fams
    ) | ~df_sorted.duplicated(  # always keep non-Ren fams
        subset=["date", "family"], keep="first"
    )
    return df_sorted.loc[keep_mask].reset_index(drop=True)


def compute_error_metrics(
    df: pd.DataFrame,
    reference_family: str = "MCD43A3",
    value_col: str = "albedo_mean",
) -> pd.DataFrame:
    """Compute an extended set of error statistics versus a reference family.

    Statistics returned
    -------------------
    N         – sample size
    bias      – mean(test − ref)
    mae       – mean|test − ref|
    rmse      – √mean((test − ref)^2)
    std_err   – standard deviation of (test − ref)
    medae     – median absolute error
    r         – Pearson correlation coefficient
    slope     – OLS slope (test = slope * ref + intercept)
    intercept – OLS intercept
    """

    # Split into dictionary of DataFrames keyed by family
    fam_groups = {fam: fam_df.set_index("date") for fam, fam_df in df.groupby("family")}

    if reference_family not in fam_groups:
        raise ValueError(f"Reference family '{reference_family}' not in data")

    ref_series = fam_groups[reference_family][value_col]

    rows = []
    for fam, fam_df in fam_groups.items():
        if fam == reference_family:
            continue
        # Align on dates
        merged = pd.concat([ref_series, fam_df[value_col]], axis=1, join="inner")
        merged.columns = ["ref", "test"]
        diff = merged["test"] - merged["ref"]
        # Linear regression and correlation
        slope, intercept = np.polyfit(merged["ref"], merged["test"], 1)
        r = np.corrcoef(merged["ref"], merged["test"])[0, 1]
        rows.append(
            {
                "family": fam,
                "N": len(diff),
                "bias": diff.mean(),
                "mae": diff.abs().mean(),
                "rmse": np.sqrt((diff**2).mean()),
                "std_err": diff.std(),
                "medae": np.median(np.abs(diff)),
                "r": r,
                "slope": slope,
                "intercept": intercept,
            }
        )
    return pd.DataFrame(rows)


# ----------------------------
# Main routine
# ----------------------------


def main():
    parser = argparse.ArgumentParser(description="Reproduce Ren vs MCD43A4 comparison.")
    parser.add_argument(
        "--csv",
        type=Path,
        default=Path("data/MOD09GA_MOD10A1_MCD43A4_Comparaison.csv"),
        help="Input CSV file path (default: data/MOD09GA_MOD10A1_MCD43A4_Comparaison.csv)",
    )
    parser.add_argument(
        "--out", type=Path, default=Path("plots"), help="Directory for output plots"
    )
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)

    # 1. Load data
    df = pd.read_csv(args.csv, parse_dates=["date"])

    # 2. Collapse Terra/Aqua duplicates as per rule
    df_filtered = collapse_terra_aqua(df)

    # 3. Compute error metrics (overall and monthly)
    metrics = compute_error_metrics(df_filtered)
    print("Overall performance vs MCD43A3:\n", metrics)

    # Save full metrics to CSV
    metrics.to_csv(args.out / "overall_error_metrics.csv", index=False)

    # Monthly breakdown
    df_filtered["month"] = df_filtered["date"].dt.month
    monthly_rows = []
    for (fam, month), sub in df_filtered.groupby(["family", "month"]):  # type: ignore[misc]
        if fam == "MCD43A3":
            continue
        ref = df_filtered[
            (df_filtered["family"] == "MCD43A3") & (df_filtered["month"] == month)
        ]
        if ref.empty:
            continue
        merged = pd.merge(
            sub.loc[:, ["date", "albedo_mean"]],  # type: ignore[arg-type]
            ref.loc[:, ["date", "albedo_mean"]],  # type: ignore[arg-type]
            on="date",
            suffixes=("_test", "_ref"),
        )
        if merged.empty:
            continue
        diff = merged["albedo_mean_test"] - merged["albedo_mean_ref"]
        monthly_rows.append(
            {
                "family": fam,
                "month": month,
                "N": len(diff),
                "bias": diff.mean(),
                "mae": diff.abs().mean(),
                "rmse": np.sqrt((diff**2).mean()),
            }
        )
    if monthly_rows:
        monthly_df = pd.DataFrame(monthly_rows)
        monthly_df.to_csv(args.out / "monthly_error_metrics.csv", index=False)
        print("Monthly metrics saved to monthly_error_metrics.csv")

    # 16-day half-month metrics (Ren et al.)
    df_filtered["halfmonth"] = (
        df_filtered["date"].dt.year.astype(str)
        + "_"
        + ((df_filtered["date"].dt.dayofyear - 1) // 16 + 1).astype(str)
    )
    hm_rows = []
    for (fam, hm), sub in df_filtered.groupby(["family", "halfmonth"]):  # type: ignore[misc]
        if fam == "MCD43A3":
            continue
        ref = df_filtered[
            (df_filtered["family"] == "MCD43A3") & (df_filtered["halfmonth"] == hm)
        ]
        if ref.empty:
            continue
        merged = pd.merge(
            sub.loc[:, ["date", "albedo_mean"]],  # type: ignore[arg-type]
            ref.loc[:, ["date", "albedo_mean"]],  # type: ignore[arg-type]
            on="date",
            how="inner",
            suffixes=("_test", "_ref"),
        )
        if merged.empty:
            continue
        diff = merged["albedo_mean_test"] - merged["albedo_mean_ref"]
        hm_rows.append(
            {
                "family": fam,
                "halfmonth": hm,
                "N": len(diff),
                "bias": diff.mean(),
                "mae": diff.abs().mean(),
                "rmse": np.sqrt((diff**2).mean()),
            }
        )
    if hm_rows:
        hm_df = pd.DataFrame(hm_rows)
        hm_df.to_csv(args.out / "halfmonth_error_metrics.csv", index=False)
        print("16-day half-month metrics saved to halfmonth_error_metrics.csv")

    # --- Residuals vs predictors -------------------------------------------
    if {"solar_zenith", "ndsi_mean"}.issubset(df_filtered.columns):
        ref_map = df_filtered[df_filtered["family"] == "MCD43A3"].set_index("date")[
            "albedo_mean"
        ]
        for fam in ["MOD09GA", "MOD10A1"]:
            fam_df = df_filtered[df_filtered["family"] == fam].set_index("date")
            merged = fam_df.join(ref_map, rsuffix="_ref", how="inner")
            merged["residual"] = merged["albedo_mean"] - merged["albedo_mean_ref"]

            # Scatter vs solar zenith
            ax = sns.scatterplot(data=merged, x="solar_zenith", y="residual", alpha=0.4)
            sns.regplot(
                data=merged,
                x="solar_zenith",
                y="residual",
                scatter=False,
                color="r",
                ax=ax,
            )
            ax.set_title(f"{fam} residual vs Solar Zenith")
            plt.tight_layout()
            plt.savefig(args.out / f"bias_vs_sza_{fam}.png", dpi=300)
            plt.clf()

            # Scatter vs NDSI
            ax = sns.scatterplot(data=merged, x="ndsi_mean", y="residual", alpha=0.4)
            sns.regplot(
                data=merged,
                x="ndsi_mean",
                y="residual",
                scatter=False,
                color="b",
                ax=ax,
            )
            ax.set_title(f"{fam} residual vs NDSI")
            plt.tight_layout()
            plt.savefig(args.out / f"bias_vs_ndsi_{fam}.png", dpi=300)
            plt.clf()

    # 4. Scatter plots (Ren & MOD10 vs MCD43)
    sns.set_style("ticks")
    sns.set_context("paper")

    for fam in ["MOD09GA", "MOD10A1"]:
        fam_df = df_filtered[df_filtered["family"] == fam].set_index("date")
        ref_df = df_filtered[df_filtered["family"] == "MCD43A3"].set_index("date")
        merged = pd.concat(
            [fam_df["albedo_mean"], ref_df["albedo_mean"]], axis=1, join="inner"
        )
        merged.columns = [fam, "MCD43A3"]

        if merged.empty:
            continue

        ax = sns.scatterplot(data=merged, x="MCD43A3", y=fam, alpha=0.6)
        max_val = merged.max().max()
        ax.plot([0, max_val], [0, max_val], "k--", lw=1)
        ax.set_aspect("equal", adjustable="box")
        ax.set_title(f"{fam} vs MCD43A3 (N={len(merged)})")
        plt.tight_layout()
        plt.savefig(args.out / f"scatter_{fam}_vs_MCD43A3.png", dpi=300)
        plt.clf()

    # 5. 16-day running mean time-series
    df_ts = (
        df_filtered.set_index("date")[["family", "albedo_mean"]]
        .pivot(columns="family", values="albedo_mean")
        .rolling(window=16, min_periods=1)
        .mean()
    )
    # The following DataFrame attributes are valid but static analysis
    # can mis-infer their types; add `type: ignore` to keep linters quiet.
    if not df_ts.empty:  # type: ignore[attr-defined]
        plt.figure(figsize=(10, 6))
        for col in df_ts.columns:  # type: ignore[attr-defined]
            plt.plot(df_ts.index, df_ts[col], label=col)  # type: ignore[attr-defined]
        plt.ylabel("16-day mean broadband albedo")
        plt.legend()
        plt.tight_layout()
        plt.savefig(args.out / "timeseries_16day_mean.png", dpi=300)
        plt.clf()


if __name__ == "__main__":
    main()
