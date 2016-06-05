// modes:
// points/circles, not lines?
// triangle strip!?

import processing.core.*;

public class ParametricLines extends VizBase
{
  // private PVector p;
  private float scale = 250; // TODO: make relative to size of canvas?

  private int size0Signal = 0; // basically, the number of objects on screen
  
  public ParametricLines(PApplet parentApplet) {
    super(parentApplet);
    name = "Parametric Lines";

    // initialize controls
    usesAlpha = true;
    minAlpha = 0;
    defaultAlpha = 100;
    maxAlpha = 255;
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

    for(int i = 0; i < (int) map(signals[size0Signal], 0, 100 / 2, 0, 50); i++) {
      // strokeWeight(5);

      strokeWeight(pow(map(signals[5], 0, 100, 0, 7), 2));
      strokeCap(SQUARE);

      stroke((frameCount + i) % 256, 256, 256, map(signals[alphaSignal], 0, 100, minAlpha, 255));
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

  @Override
  public float setAlpha(float value, boolean normalized) {
    minAlpha = normalized ? value : map(value, 0, 127, 0, 255);
    return minAlpha;
  }

  @Override
  public void setAlphaSignal(int value) {
    alphaSignal = value;
  }


}

