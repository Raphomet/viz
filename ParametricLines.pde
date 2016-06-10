// modes:
// points/circles, not lines?
// triangle strip!?

import processing.core.*;

public class ParametricLines extends VizBase
{
  // private PVector p;
  private float scale = 250; // TODO: make relative to size of canvas?

  private float alpha;
  private float size0;
  private float size1;
  private int colorPalette = 0;
  private float colorAdjustment;
  private int mode = 0;
  private float x0;
  // private int size0Signal = 0; // length of tail
  // private int size1Signal = 0; // thickness
  
  public ParametricLines(PApplet parentApplet) {
    super(parentApplet);
    name = "Parametric Lines";

    // initialize controls

    usesSize0 = true;
    minSize0 = 1;
    maxSize0 = 255;
    defaultSize0 = 50;
    size0 = defaultSize0;

    usesSize1 = true;
    minSize1 = 1;
    maxSize1 = 255;
    defaultSize1 = 50;
    size1 = defaultSize1;

    usesColorPalette = true;
    numColorPalettes = 2;

    usesColorAdjustment = true;
    minColorAdjustment = 0;
    maxColorAdjustment = 255;
    defaultColorAdjustment = 255;
    colorAdjustment = defaultColorAdjustment;

    usesAlpha = true;
    minAlpha = 0;
    maxAlpha = 255;
    defaultAlpha = 100;
    alpha = defaultAlpha;

    usesMode = true;
    numModes = 4;

    usesX0 = true;
    minX0 = 1;
    maxX0 = 30;
    defaultX0 = 13;
    x0 = defaultX0;
  }
  
  @Override
  public void init() {
    colorMode(HSB, 256);
  }

  @Override
  void display(float[] signals) {
    translate(width / 2, height / 2);

    int backgroundColor;
    if (colorPalette == 0) {
      backgroundColor = 0;
    }
    else {
      backgroundColor = 255;
    }
    background(backgroundColor);

    if (mode == 2) {
      beginShape(TRIANGLE_STRIP);
    }

    if (mode == 3) {
      beginShape();
      noFill();
      strokeWeight(5);

      stroke(255, 255, 255);
      for (float i = 0; i < TWO_PI * 100; i += PI / 10) {
        vertex(x1(i), y1(i));
      }

      stroke(64, 255, 255);
      for (float i = 0; i < TWO_PI * 100; i += PI / 10) {
        vertex(x2(i), y2(i));
      }

      endShape();
    }
    else {
      for(int i = 0; i < (int) map(signals[size0Signal], 0, 100, 0, size0); i++) {
        // strokeWeight(5);
        if (mode == 0) {
          noFill();
          strokeWeight(pow(map(signals[5], 0, 100, 0, sqrt(size1)), 2));
          strokeCap(SQUARE);
          stroke((frameCount + i) % 256, colorAdjustment, 256, map(signals[alphaSignal], 0, 100, alpha, 255));
          line(x1(frameCount + i), y1(frameCount + i), x2(frameCount + i), y2(frameCount + i));
        }
        else if (mode == 1) {
          noStroke();
          fill((frameCount + i) % 256, colorAdjustment, 256, map(signals[alphaSignal], 0, 100, alpha, 255));
          ellipse(x1(frameCount + i), y1(frameCount + i), size1, size1);
          ellipse(x2(frameCount + i), y2(frameCount + i), size1, size1);
        }
        else if (mode == 2) {
          noFill();
          strokeWeight(pow(map(signals[5], 0, 100, 0, sqrt(size1)), 2));
          strokeCap(SQUARE);
          stroke((frameCount + i) % 256, colorAdjustment, 256, map(signals[alphaSignal], 0, 100, alpha, 255));
          vertex(x1(frameCount + i), y1(frameCount + i));
          vertex(x2(frameCount + i), y2(frameCount + i));
        }
      }
    }


    if (mode == 2) {
      endShape();
    }

  }

  float x1(float t) {
    return cos(t / x0) * scale + sin(t / 80) * 30;
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
  public float setSize0(float value, boolean normalized) {
    size0 = normalized ? value : map(value, 0, 127, minSize0, maxSize0);
    println("size0 changed to " + size0);
    return size0;
  }

  @Override
  public float setSize1(float value, boolean normalized) {
    size1 = normalized ? value : map(value, 0, 127, minSize1, maxSize1);
    println("size1 changed to " + size1);
    return size1;
  }

  @Override
  public float setColorPalette(float value, boolean normalized) {
    colorPalette = normalized ? round(value) : round(map(value, 0, 127, 0, numColorPalettes - 1));
    println("color palette changed to " + colorPalette);
    return (float)colorPalette;
  }

  @Override
  public float setColorAdjustment(float value, boolean normalized) {
    colorAdjustment = normalized ? value : map(value, 0, 127, minColorAdjustment, maxColorAdjustment);
    println("color adjustment changed to " + colorAdjustment);
    return colorAdjustment;
  }

  @Override
  public float setAlpha(float value, boolean normalized) {
    alpha = normalized ? value : map(value, 0, 127, 0, 255);
    println("alpha changed to " + alpha);
    return alpha;
  }

  @Override
  public void setAlphaSignal(int value) {
    alphaSignal = value;
  }

  @Override
  public float setMode(float value, boolean normalized) {
    mode = normalized ? round(value) : round(map(value, 0, 127, 0, numModes - 1));
    println("mode changed to " + mode);
    return (float)mode;
  }

  @Override
  public float setX0(float value, boolean normalized) {
    x0 = normalized ? value : map(value, 0, 127, minX0, maxX0);
    println("x0 changed to " + x0);
    return x0;
  }



}

