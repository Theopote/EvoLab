import {
  encodeCanvasToDataUrl,
  loadImage,
  quadToPixelCoordinates,
  type ImagePoint,
  type PerspectiveQuad
} from "@/lib/import-image-utils";

const MAX_OUTPUT_DIMENSION = 2048;

function distance(a: ImagePoint, b: ImagePoint) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function estimatePerspectiveOutputSize(quad: PerspectiveQuad) {
  const [topLeft, topRight, bottomRight, bottomLeft] = quad;
  const topWidth = distance(topLeft, topRight);
  const bottomWidth = distance(bottomLeft, bottomRight);
  const leftHeight = distance(topLeft, bottomLeft);
  const rightHeight = distance(topRight, bottomRight);

  return {
    width: Math.max(1, Math.round((topWidth + bottomWidth) / 2)),
    height: Math.max(1, Math.round((leftHeight + rightHeight) / 2))
  };
}

function solveLinearSystem(matrix: number[][], vector: number[]) {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;

    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivotRow][column])) {
        pivotRow = row;
      }
    }

    const pivot = augmented[pivotRow];
    augmented[pivotRow] = augmented[column];
    augmented[column] = pivot;

    const pivotValue = augmented[column][column];

    if (Math.abs(pivotValue) < 1e-10) {
      throw new Error("Perspective transform is degenerate. Adjust the corner handles.");
    }

    for (let index = column; index <= size; index += 1) {
      augmented[column][index] /= pivotValue;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) {
        continue;
      }

      const factor = augmented[row][column];

      for (let index = column; index <= size; index += 1) {
        augmented[row][index] -= factor * augmented[column][index];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

/** Maps destination coordinates to source image coordinates. */
export function computeDestinationToSourceHomography(
  sourceQuad: PerspectiveQuad,
  outputWidth: number,
  outputHeight: number
) {
  const destinationQuad: PerspectiveQuad = [
    [0, 0],
    [outputWidth, 0],
    [outputWidth, outputHeight],
    [0, outputHeight]
  ];
  const matrix: number[][] = [];
  const vector: number[] = [];

  for (let index = 0; index < 4; index += 1) {
    const [sourceX, sourceY] = sourceQuad[index];
    const [destX, destY] = destinationQuad[index];

    matrix.push([destX, destY, 1, 0, 0, 0, -destX * sourceX, -destY * sourceX]);
    vector.push(sourceX);
    matrix.push([0, 0, 0, destX, destY, 1, -destX * sourceY, -destY * sourceY]);
    vector.push(sourceY);
  }

  return solveLinearSystem(matrix, vector);
}

export function mapPointWithHomography(homography: number[], point: ImagePoint): ImagePoint {
  const [x, y] = point;
  const [h0, h1, h2, h3, h4, h5, h6, h7] = homography;
  const denominator = h6 * x + h7 * y + 1;

  return [(h0 * x + h1 * y + h2) / denominator, (h3 * x + h4 * y + h5) / denominator];
}

function sampleBilinear(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number
) {
  if (x < 0 || y < 0 || x >= width - 1 || y >= height - 1) {
    return [255, 255, 255, 255];
  }

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const tx = x - x0;
  const ty = y - y0;
  const values = [];

  for (let channel = 0; channel < 4; channel += 1) {
    const topLeft = pixels[(y0 * width + x0) * 4 + channel];
    const topRight = pixels[(y0 * width + x1) * 4 + channel];
    const bottomLeft = pixels[(y1 * width + x0) * 4 + channel];
    const bottomRight = pixels[(y1 * width + x1) * 4 + channel];
    const top = topLeft * (1 - tx) + topRight * tx;
    const bottom = bottomLeft * (1 - tx) + bottomRight * tx;
    values.push(top * (1 - ty) + bottom * ty);
  }

  return values;
}

function readImagePixels(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not available for perspective correction.");
  }

  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

export async function applyPerspectiveCorrection(
  dataUrl: string,
  normalizedQuad: PerspectiveQuad
) {
  const image = await loadImage(dataUrl);
  const sourceQuad = quadToPixelCoordinates(normalizedQuad, image.naturalWidth, image.naturalHeight);
  const targetSize = estimatePerspectiveOutputSize(sourceQuad);
  const scale = Math.min(1, MAX_OUTPUT_DIMENSION / Math.max(targetSize.width, targetSize.height));
  const outputWidth = Math.max(1, Math.round(targetSize.width * scale));
  const outputHeight = Math.max(1, Math.round(targetSize.height * scale));
  const homography = computeDestinationToSourceHomography(sourceQuad, outputWidth, outputHeight);
  const sourcePixels = readImagePixels(image);
  const output = new ImageData(outputWidth, outputHeight);

  for (let y = 0; y < outputHeight; y += 1) {
    for (let x = 0; x < outputWidth; x += 1) {
      const [sourceX, sourceY] = mapPointWithHomography(homography, [x, y]);
      const [red, green, blue, alpha] = sampleBilinear(
        sourcePixels.data,
        sourcePixels.width,
        sourcePixels.height,
        sourceX,
        sourceY
      );
      const offset = (y * outputWidth + x) * 4;
      output.data[offset] = red;
      output.data[offset + 1] = green;
      output.data[offset + 2] = blue;
      output.data[offset + 3] = alpha;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not available for perspective correction.");
  }

  context.putImageData(output, 0, 0);

  return encodeCanvasToDataUrl(canvas, dataUrl);
}
