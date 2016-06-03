import processing.core.*;

public class DotMatrix extends VizBase {
  // visualization-dependent variables
  color   background = #FFFFFF;

  int matrixWidth = 30;
  int matrixHeight = 6;

  LinkedList dotMatrix = new LinkedList();

  public DotMatrix(PApplet parentApplet) {
    super(parentApplet);
    name = "Dot Matrix";
  }

  @Override
  public void init() {

    for (int i = 0; i < matrixWidth * matrixHeight; i++) {
      dotMatrix.offer(new CellDotData(0, null));
    }
    // cf = new ControlFrame(this, cfWidth, cfHeight, "Controls");

    // TODO: find some other way to slow down the animation speed
    // frameRate(10);
  }

  void keyPressed() {
    if (key == ' ') {
      dotMatrix.clear();
      for (int i = 0; i < matrixWidth * matrixHeight; i++) {
        dotMatrix.offer(new CellDotData(0, null));
      }
    }
  }

  @Override
  void display(float[] signals) {
    background(background);

    // add new signal to matrix
    int numDots = round(map(signals[0], 0, 100, 1, 6));
    dotMatrix.poll();
    dotMatrix.offer(new CellDotData(numDots, null));

    // draw the matrix
    int padding = 100;
    float cellWidth = (width - (padding * 2)) / matrixWidth;
    float cellHeight = (height - (padding * 2)) / matrixHeight;

    for (int j = 0; j < matrixHeight; j++) {
      for (int i = 0; i < matrixWidth; i++) {

        pushMatrix();
        translate(padding + cellWidth * i + (cellWidth), padding + cellHeight * (j + 1));

        CellDotData dotData = (CellDotData)dotMatrix.get(j * matrixWidth + i);

        noStroke();
        for (int k = 0; k < dotData.numDots; k++) {
          if (k == 5) {
            fill(255, 0, 0);
          }
          else {
            fill(0);
          }

          ellipse(0, -8 * k, 5 ,5);
        }

        popMatrix();
      }
    }
  }

  // POJO
  class CellDotData {
    int numDots;
    byte[] colorings;

    public CellDotData(int _numDots, byte[] _colorings) {
      numDots = _numDots;
      colorings = _colorings;
    }
  }


}



