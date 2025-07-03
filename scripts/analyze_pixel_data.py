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
    for (month, _), sub in df_reset.groupby(["month"]):
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


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Analyse d'un CSV de pixels MODIS")
    parser.add_argument("--csv", type=Path, required=True, help="Chemin du CSV d'entrée")
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

    # Write Markdown
    write_markdown(
        args.report,
        df,
        desc,
        uniq_pixels,
        metrics_df,
        monthly_df,
        img_paths,
    )
    print("✅ Rapport généré :", args.report)


if __name__ == "__main__":
    main() 