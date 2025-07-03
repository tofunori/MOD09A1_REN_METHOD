#!/usr/bin/env python3
"""analyze_pixel_data.py

Analyse un fichier CSV issu du script GEE *Pixel Export*.
Pour une période donnée, produit :
1. Statistiques descriptives par méthode.
2. Tableaux bias / RMSE et corrélations entre méthodes.
3. Graphiques : nuages de points, histogrammes, courbes mensuelles.
4. Un rapport Markdown récapitulatif avec inclusion des figures.

Usage
-----
$ python analyze_pixel_data.py \
        --csv data/Pixel_Data_2023.csv \
        --plots plots/pixel_2023 \
        --report docs/Pixel_Data_2023_analysis.md
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd
import seaborn as sns
import matplotlib

matplotlib.use("Agg")  # headless
import matplotlib.pyplot as plt  # noqa: E402
from scipy.stats import pearsonr  # noqa: E402

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def ensure_dir(path: Path) -> None:
    """Create directory (parents=True) if it does not exist."""
    path.mkdir(parents=True, exist_ok=True)


def descriptive_stats(df: pd.DataFrame) -> pd.DataFrame:
    return df.groupby("method")["albedo_value"].describe().round(4)


def pixel_counts(df: pd.DataFrame) -> pd.Series:
    return df.groupby("method")["pixel_id"].nunique()


def full_intersection(df: pd.DataFrame) -> pd.DataFrame:
    """Pivot on (pixel_id, date) and drop rows with NaNs (incomplete)."""
    return (
        df.pivot_table(
            index=["pixel_id", "date"],
            columns="method",
            values="albedo_value",
            aggfunc="first",
        )
        .dropna()
        .sort_index()
    )


def scatter_and_metrics(
    pivot: pd.DataFrame,
    methods: list[str],
    plots_dir: Path,
) -> pd.DataFrame:
    rows = []
    ensure_dir(plots_dir)
    for i, m1 in enumerate(methods):
        for m2 in methods[i + 1 :]:
            if m1 not in pivot or m2 not in pivot:
                continue
            diff = pivot[m1] - pivot[m2]
            r, _ = pearsonr(pivot[m1], pivot[m2])
            rmse = np.sqrt((diff**2).mean())
            bias = diff.mean()
            rows.append({
                "pair": f"{m1} vs {m2}",
                "N": len(diff),
                "r": r,
                "bias": bias,
                "rmse": rmse,
            })
            # scatter plot
            plt.figure(figsize=(4, 4))
            lim = (0, 1)
            sns.scatterplot(x=pivot[m1], y=pivot[m2], s=8, alpha=0.4)
            plt.plot(lim, lim, "k--", linewidth=1)
            plt.xlim(lim)
            plt.ylim(lim)
            plt.xlabel(m1)
            plt.ylabel(m2)
            plt.title(f"{m1} vs {m2}\nr={r:.2f}, RMSE={rmse:.3f}")
            fname = plots_dir / f"scatter_{m1}_{m2}.png"
            plt.tight_layout()
            plt.savefig(fname, dpi=150)
            plt.close()
    return pd.DataFrame(rows)


def monthly_metrics(
    pivot: pd.DataFrame, ref: str, plots_dir: Path
) -> tuple[pd.DataFrame, Path, Path]:
    rows = []
    df_reset = pivot.reset_index()
    df_reset["month"] = df_reset["date"].dt.month
    for month, sub in df_reset.groupby("month"):
        for m in pivot.columns:
            if m == ref:
                continue
            diff = sub[m] - sub[ref]
            rows.append(
                {
                    "month": month,
                    "method": m,
                    "N": len(diff),
                    "bias": diff.mean(),
                    "rmse": np.sqrt((diff**2).mean()),
                }
            )
    monthly_df = pd.DataFrame(rows)

    # bias plot
    plt.figure(figsize=(6, 4))
    for m, grp in monthly_df.groupby("method"):
        plt.plot(grp["month"], grp["bias"], marker="o", label=m)
    plt.axhline(0, color="k", linewidth=0.5)
    plt.xlabel("Mois")
    plt.ylabel("Biais (test − ref)")
    plt.title("Biais mensuel vs " + ref)
    plt.grid(True, linestyle=":")
    plt.legend()
    bias_img = plots_dir / "monthly_bias.png"
    plt.tight_layout()
    plt.savefig(bias_img, dpi=150)
    plt.close()

    # rmse plot
    plt.figure(figsize=(6, 4))
    for m, grp in monthly_df.groupby("method"):
        plt.plot(grp["month"], grp["rmse"], marker="o", label=m)
    plt.xlabel("Mois")
    plt.ylabel("RMSE")
    plt.title("RMSE mensuel vs " + ref)
    plt.grid(True, linestyle=":")
    plt.legend()
    rmse_img = plots_dir / "monthly_rmse.png"
    plt.tight_layout()
    plt.savefig(rmse_img, dpi=150)
    plt.close()

    return monthly_df, bias_img, rmse_img


def histograms(df: pd.DataFrame, plots_dir: Path, methods: list[str]) -> list[Path]:
    imgs = []
    for m in methods:
        plt.figure(figsize=(5, 3))
        sns.histplot(df[df["method"] == m]["albedo_value"], bins=40, kde=True)
        plt.xlabel("Albedo")
        plt.title(f"Distribution {m}")
        img_path = plots_dir / f"hist_{m}.png"
        plt.tight_layout()
        plt.savefig(img_path, dpi=150)
        plt.close()
        imgs.append(img_path)
    return imgs


def write_markdown(
    md_path: Path,
    df: pd.DataFrame,
    desc: pd.DataFrame,
    uniq_pixels: pd.Series,
    metrics_df: pd.DataFrame,
    monthly_df: pd.DataFrame,
    img_paths: list[Path],
    pixel_csv: Path,
    corr_df: pd.DataFrame,
    corrected_df: pd.DataFrame,
    pixel_metrics: pd.DataFrame,
    sza_df: pd.DataFrame | None,
    sza_corr: float | None,
    elev_corr_df: pd.DataFrame | None,
):
    with md_path.open("w", encoding="utf-8") as f:
        f.write(f"# Analyse de {md_path.stem}\n\n")
        f.write("## Vue d'ensemble\n")
        f.write(f"- Mesures totales : **{len(df):,}**\n")
        f.write("\n")
        f.write("### Pixels distincts\n")
        for m, n in uniq_pixels.items():
            f.write(f"- {m} : {n}\n")
        f.write("\n")

        f.write("## Statistiques descriptives\n")
        f.write(desc.to_markdown())
        f.write("\n\n")

        f.write("## Corrélations / Bias / RMSE (global)\n")
        f.write(metrics_df.round(3).to_markdown(index=False))
        f.write("\n\n")

        f.write("## Biais & RMSE mensuels (vs MCD43A3)\n")
        f.write(monthly_df.round(3).to_markdown(index=False))
        f.write("\n\n")

        f.write("## Figures\n")
        for p in img_paths:
            f.write(f"![figure]({p.as_posix()})\n")

        f.write("\n## Fichier métriques par pixel\n")
        f.write(f"Export CSV : `{pixel_csv.as_posix()}`\n")

        # Top biais
        top = pixel_metrics.sort_values("bias", ascending=False).head(10)[["pixel_id","method","bias","rmse"]]
        f.write("\n### Pixels avec biais le plus élevé\n")
        f.write(top.round(3).to_markdown(index=False))

        # Corrélation bias vs N
        f.write("\n\n### Corrélation |bias| – N\n")
        f.write(corr_df.round(3).to_markdown(index=False))

        # RMSE avant/après correction
        f.write("\n\n### Impact de la correction par pixel\n")
        f.write(corrected_df.round(4).to_markdown(index=False))

        # ---------------- SZA ----------------
        if sza_df is not None and sza_corr is not None:
            f.write("\n\n## Influence de l'angle solaire (MOD09GA)\n")
            f.write(f"Corrélation bias–SZA : **r = {sza_corr:.2f}**\n\n")
            f.write(sza_df.round(3).to_markdown(index=False))

        # ---------------- Elevation ---------------
        if elev_corr_df is not None:
            f.write("\n\n## Influence de l'élévation\n")
            f.write(elev_corr_df.round(3).to_markdown(index=False))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Analyse d'un CSV de pixels MODIS")
    parser.add_argument("--csv", type=Path, default=Path("data/Pixel_Data_2023.csv"), help="Chemin du CSV d'entrée (par défaut: data/Pixel_Data_2023.csv)")
    parser.add_argument("--plots", type=Path, default=Path("plots"), help="Dossier pour les figures")
    parser.add_argument("--report", type=Path, default=Path("docs/report.md"), help="Fichier Markdown de sortie")
    args = parser.parse_args()

    # Chargement
    df = pd.read_csv(args.csv)
    if "date" not in df.columns or "method" not in df.columns:
        raise ValueError("Le CSV doit contenir les colonnes 'date' et 'method'.")
    df["date"] = pd.to_datetime(df["date"])

    ensure_dir(args.plots)
    ensure_dir(args.report.parent)

    # Stats globales
    desc = descriptive_stats(df)
    uniq_pixels = pixel_counts(df)

    # Intersection complète
    pivot = full_intersection(df)
    methods = sorted(pivot.columns)

    metrics_df = scatter_and_metrics(pivot, methods, args.plots)
    monthly_df, bias_img, rmse_img = monthly_metrics(pivot, "MCD43A3", args.plots)
    img_paths = list((args.plots).glob("*.png"))  # include all generated images

    # Histograms (added after glob to avoid duplication)
    hist_imgs = histograms(df, args.plots, methods)
    img_paths.extend(hist_imgs)

    # ------------------------------------------------------------------
    # NEW : métriques par pixel (bias & RMSE) sur toute la saison
    # ------------------------------------------------------------------
    pixel_rows = []
    ref = "MCD43A3"
    for pid, sub in pivot.groupby(level=0):
        if len(sub) < 5:
            continue  # trop peu de points
        for m in [c for c in pivot.columns if c != ref]:
            diff = sub[m] - sub[ref]
            pixel_rows.append({
                "pixel_id": pid,
                "method": m,
                "N": len(diff),
                "bias": diff.mean(),
                "rmse": np.sqrt((diff**2).mean()),
            })
    pixel_metrics = pd.DataFrame(pixel_rows)
    pixel_csv = args.plots / "per_pixel_metrics.csv"
    pixel_metrics.to_csv(pixel_csv, index=False)

    # Ajouter un boxplot des biais par pixel
    if not pixel_metrics.empty:
        plt.figure(figsize=(6,4))
        sns.boxplot(data=pixel_metrics, x="method", y="bias")
        plt.title("Distribution du biais par pixel (saison)")
        box_img = args.plots / "box_bias_per_pixel.png"
        plt.tight_layout(); plt.savefig(box_img, dpi=150); plt.close()
        img_paths.append(box_img)

    # ------------------------------------------------------------------
    # NEW : nombre d'observations complètes par mois
    # ------------------------------------------------------------------
    month_counts = pivot.reset_index().groupby(pivot.reset_index()["date"].dt.month).size()
    plt.figure(figsize=(5,3))
    month_counts.plot(kind="bar")
    plt.xlabel("Mois")
    plt.ylabel("N obs complètes")
    plt.title("Observations complètes par mois")
    obs_img = args.plots / "monthly_counts.png"
    plt.tight_layout(); plt.savefig(obs_img, dpi=150); plt.close()
    img_paths.append(obs_img)

    # ------------------------------------------------------------------
    # Corrélation |bias| vs N et scatter
    # ------------------------------------------------------------------
    corr_rows = []
    scatter_bias_n = args.plots / "scatter_bias_vs_N.png"
    plt.figure(figsize=(5,3))
    for m, sub in pixel_metrics.groupby("method"):
        abs_bias = sub["bias"].abs()
        n_obs = sub["N"]
        r = np.corrcoef(abs_bias, n_obs)[0,1]
        corr_rows.append({"method": m, "r_bias_N": r})
        plt.scatter(n_obs, abs_bias, label=f"{m} (r={r:.2f})", alpha=0.6, s=20)
    plt.xlabel("N observations par pixel")
    plt.ylabel("|bias|")
    plt.title("Corrélation |bias| – N")
    plt.legend(); plt.grid(True, linestyle=":")
    plt.tight_layout(); plt.savefig(scatter_bias_n, dpi=150); plt.close()
    img_paths.append(scatter_bias_n)
    corr_df = pd.DataFrame(corr_rows)

    # ------------------------------------------------------------------
    # Correction par pixel (Albedo_corr = Albedo_test - bias_pixel)
    # ------------------------------------------------------------------
    corrected_metrics = []
    for test_method in [c for c in methods if c != "MCD43A3"]:
        # map pixel_id -> bias for this method
        bias_map = pixel_metrics[pixel_metrics["method"]==test_method].set_index("pixel_id")["bias"].to_dict()
        adj = []
        for (pid, date), row in pivot.iterrows():
            if pid in bias_map:
                adj.append(row[test_method] - bias_map[pid])
            else:
                adj.append(np.nan)
        pivot[f"{test_method}_corr"] = adj
        diff_raw = pivot[test_method] - pivot["MCD43A3"]
        diff_corr = pivot[f"{test_method}_corr"] - pivot["MCD43A3"]
        rmse_raw = np.sqrt((diff_raw**2).mean())
        rmse_corr = np.sqrt((diff_corr**2).mean())
        corrected_metrics.append({"method": test_method, "rmse_raw": rmse_raw, "rmse_corr": rmse_corr})
    corrected_df = pd.DataFrame(corrected_metrics)

    # ------------------------------------------------------------------
    # ANALYSE SOLAR ZENITH (mod09GA seulement)
    # ------------------------------------------------------------------
    sza_df = None
    sza_corr = None
    if "solar_zenith" in df.columns:
        # Merge MOD09GA rows with reference to obtenir bias par observation
        mod = df[df["method"] == "MOD09GA"].copy()
        ref = df[df["method"] == "MCD43A3"][["pixel_id", "date", "albedo_value"]].rename({"albedo_value": "ref_val"}, axis=1)
        mod = mod.merge(ref, on=["pixel_id", "date"], how="inner")
        mod["bias"] = mod["albedo_value"] - mod["ref_val"]
        sza_corr = np.corrcoef(mod["solar_zenith"], mod["bias"])[0, 1]
        # scatter
        sza_img = args.plots / "scatter_bias_vs_sza.png"
        plt.figure(figsize=(5,3))
        plt.scatter(mod["solar_zenith"], mod["bias"], alpha=0.3, s=10)
        plt.xlabel("Solar Zenith Angle (°)")
        plt.ylabel("Bias (MOD09GA - ref)")
        plt.title(f"Bias vs SZA (r={sza_corr:.2f})")
        plt.grid(True, linestyle=":")
        plt.tight_layout(); plt.savefig(sza_img, dpi=150); plt.close()
        img_paths.append(sza_img)
        # bin stats
        bins = pd.cut(mod["solar_zenith"], bins=[0,30,40,50,60,90])
        sza_df = mod.groupby(bins)["bias"].agg(["count","mean","std"]).reset_index().rename({"solar_zenith":"sza_bin"}, axis=1)

    # ------------------------------------------------------------------
    # ANALYSE ÉLÉVATION – corrélation bias pixel
    # ------------------------------------------------------------------
    elev_corr_df = None
    if "elevation" in df.columns:
        elev_map = df.groupby("pixel_id")["elevation"].mean()
        pixel_metrics = pixel_metrics.merge(elev_map, on="pixel_id", how="left")
        # scatter by method
        elev_img = args.plots / "scatter_bias_vs_elev.png"
        plt.figure(figsize=(5,3))
        elev_corr_rows = []
        for m, sub in pixel_metrics.groupby("method"):
            r = np.corrcoef(sub["elevation"], sub["bias"])[0,1]
            elev_corr_rows.append({"method": m, "r_bias_elev": r})
            plt.scatter(sub["elevation"], sub["bias"], label=f"{m} (r={r:.2f})", alpha=0.6, s=20)
        plt.xlabel("Elevation (m)")
        plt.ylabel("Bias par pixel")
        plt.title("Bias vs Elevation")
        plt.legend(); plt.grid(True, linestyle=":")
        plt.tight_layout(); plt.savefig(elev_img, dpi=150); plt.close()
        img_paths.append(elev_img)
        elev_corr_df = pd.DataFrame(elev_corr_rows)

    # Write Markdown
    write_markdown(
        args.report,
        df,
        desc,
        uniq_pixels,
        metrics_df,
        monthly_df,
        img_paths,
        pixel_csv,
        corr_df,
        corrected_df,
        pixel_metrics,
        sza_df,
        sza_corr,
        elev_corr_df,
    )
    print("✅ Rapport généré :", args.report)


if __name__ == "__main__":
    main() 