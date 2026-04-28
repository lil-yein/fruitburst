// Loads fruit + bomb art and provides quick random access.
//
// Assets live in /public/assets/{fruits,bombs}/. The browser rasterizes
// SVGs to bitmaps once on load; subsequent ctx.drawImage() calls just blit.

const FRUIT_NAMES = [
  'apple',
  'banana',
  'cherry',
  'dragon',
  'kiwi',
  'orange',
  'pineapple',
] as const;

export type FruitName = (typeof FRUIT_NAMES)[number];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

export class AssetRegistry {
  private fruits: HTMLImageElement[] = [];
  private bomb: HTMLImageElement | null = null;
  private crosshair: HTMLImageElement | null = null;

  async load(): Promise<void> {
    const fruitImgs = await Promise.all(
      FRUIT_NAMES.map((n) => loadImage(`/assets/fruits/${n}.svg`))
    );
    const [bombImg, crosshairImg] = await Promise.all([
      loadImage('/assets/bombs/bomb.svg'),
      loadImage('/assets/ui/crosshair.svg'),
    ]);
    this.fruits = fruitImgs;
    this.bomb = bombImg;
    this.crosshair = crosshairImg;
  }

  /** Returns a uniformly random fruit image. */
  randomFruit(): HTMLImageElement {
    if (this.fruits.length === 0) {
      throw new Error('AssetRegistry not loaded');
    }
    return this.fruits[Math.floor(Math.random() * this.fruits.length)];
  }

  bombImage(): HTMLImageElement {
    if (!this.bomb) throw new Error('AssetRegistry not loaded');
    return this.bomb;
  }

  crosshairImage(): HTMLImageElement {
    if (!this.crosshair) throw new Error('AssetRegistry not loaded');
    return this.crosshair;
  }
}
