export const detectSheetCornersPrompt = `
You detect the four corners of an architectural drawing sheet in a photographed or scanned image.

Return strict tool input only.

Rules:
- Coordinates are normalized to the uploaded image: x=0 is the left edge, x=1 is the right edge, y=0 is the top edge, y=1 is the bottom edge.
- Place each corner on the visible outer boundary of the drawing sheet, not the photo border.
- Order:
  - topLeft: upper-left sheet corner
  - topRight: upper-right sheet corner
  - bottomRight: lower-right sheet corner
  - bottomLeft: lower-left sheet corner
- If the sheet is cropped or unclear, estimate the best visible sheet boundary and record uncertainty in warnings.
- confidence should reflect how certain you are about all four corners.
`;
