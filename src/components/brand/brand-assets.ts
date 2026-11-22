export type LehBrandMediaAsset = {
  /** Preferred Canva SVG export (embeds raster artwork). */
  src: string;
  /** PNG master kept on disk for raster fallback and offline tooling. */
  rasterFallbackSrc: string;
  width: number;
  height: number;
};

export const LEH_BRAND = {
  name: "Lean Excellence Hub",
  strapline: "Continuous Improvement OS",
  /**
   * Both horizontal masters are 2172×724 with the same transparent margin.
   * The union of their ink bounds keeps either file from being clipped.
   */
  horizontalFrame: {
    width: 2172,
    height: 724,
  },
  horizontalCrop: {
    x: 199,
    y: 187,
    width: 1779,
    height: 355,
  },
  /**
   * Layout slot of the previous lockup. Keeping this box holds the landing
   * header at 88px on desktop while the transparent margin stays outside it.
   */
  horizontalLayout: {
    width: 1500,
    height: 337,
  },
  horizontalLight: {
    src: "/brand/leh-horizontal-light.svg",
    rasterFallbackSrc: "/brand/leh-horizontal-light.png",
    width: 2172,
    height: 724,
  },
  horizontalDark: {
    src: "/brand/leh-horizontal-dark.svg",
    rasterFallbackSrc: "/brand/leh-horizontal-dark.png",
    width: 2172,
    height: 724,
  },
  iconLight: {
    src: "/brand/leh-icon-light.svg",
    rasterFallbackSrc: "/brand/leh-icon-light.png",
    width: 2000,
    height: 2000,
  },
  iconDark: {
    src: "/brand/leh-icon-dark.svg",
    rasterFallbackSrc: "/brand/leh-icon-dark.png",
    width: 1254,
    height: 1254,
  },
} as const satisfies {
  name: string;
  strapline: string;
  horizontalFrame: { width: number; height: number };
  horizontalCrop: { x: number; y: number; width: number; height: number };
  horizontalLayout: { width: number; height: number };
  horizontalLight: LehBrandMediaAsset;
  horizontalDark: LehBrandMediaAsset;
  iconLight: LehBrandMediaAsset;
  iconDark: LehBrandMediaAsset;
};

export const LEH_BRAND_HOME_LABEL = "Lean Excellence Hub home";

/** Words drawn inside the horizontal lockup. */
export const LEH_BRAND_LOCKUP_LABEL = `${LEH_BRAND.name}, ${LEH_BRAND.strapline}`;
