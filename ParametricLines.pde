import processing.core.*;

public class ParametricLines extends VizBase
{
  // private PVector p;
  private float scale = 250; // TODO: make relative to size of canvas?
  
  public ParametricLines(PApplet parentApplet) {
    super(parentApplet);
    name = "Parametric Lines";
  }
  
  @Override
  public void init() {
    colorMode(HSB, 256);
    background(0);
  }

  @Override
  void display(float[] signals) {
    translate(width / 2, height / 2);

    // Draw lines
    int lines = 10;

    background(0);

    for(int i = 0; i < (int) map(signals[0], 0, 100 / 2, 0, 50); i++) {
      // strokeWeight(5);

      strokeWeight(pow(map(signals[5], 0, 100, 0, 7), 2));
      strokeCap(SQUARE);

      stroke((frameCount + i) % 256, 256, 256, map(signals[5], 0, 100, 100, 255));
      line(x1(frameCount + i), y1(frameCount + i), x2(frameCount + i), y2(frameCount + i));
    }
  }

  float x1(float t) {
    return cos(t / 13) * scale + sin(t / 80) * 30;
  }

  float y1(float t) {
    return sin(t / 10) * scale;
  }

  float x2(float t) {
    return cos(t / 5) * scale + cos(t / 7) * 2;
  }

  float y2(float t) {
    return sin(t / 20) * scale + cos(t / 9) * 30;
  }
}

