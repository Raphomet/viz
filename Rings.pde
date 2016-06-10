// Some ideas
// - Bar length reacts to music (assign random FFT)
// - different circles rotate at different rates, including opposite directions
// - color palettes obviously
// - wiggly borders
// - shape themes (drawn shapes; letters; emoji; igor heads)
// - ring zoom
// - alternate ring types, like in that Black viz

// color palettes
// - black white
// - rings are colored
// - individual lines are colored

import processing.core.*;
import java.util.*;

public class Rings extends VizBase
{  
  private float[] ringRotationSpeed;
  private boolean[] ringDisabled;

  private List<List<Integer>> ringParticleColors;

  public Rings(PApplet parentApplet) {
    super(parentApplet);
    name = "Rings";

    usesSize0 = true;
    minSize0 = 1;
    maxSize0 = 20;
    defaultSize0 = 5;
    size0 = defaultSize0;

    usesSize1 = true;
    minSize1 = 0.1;
    maxSize1 = 10;
    defaultSize1 = 1;
    size1 = defaultSize1;

    usesColorPalette = true;
    numColorPalettes = 3;
    // 0: rings are static colors
    // 1: rings rotate through color space
    // TODO 2: each particle is a random color
    // TODO up: preset palettes

    usesColorAdjustment = true;
    minColorAdjustment = 0;
    maxColorAdjustment = 255;
    defaultColorAdjustment = 0;
    colorAdjustment = defaultColorAdjustment;


    usesMode = true;
    numModes = 4;

    // TODO: use x0 to control density
    usesX0 = true;
    minX0 = 0.1;
    maxX0 = 3;
    defaultX0 = 1.0;
    x0 = defaultX0;

    usesZ0 = true;
    minZ0 = 0.1;
    maxZ0 = 3;
    defaultZ0 = 1;
    z0 = defaultZ0;

    usesSpeed = true;
    minSpeed = 0.1;
    maxSpeed = 3;
    defaultSpeed = 1;
    speed = defaultSpeed;
  }
  
  @Override
  public void init() {
    randomizeRingSettings();
    colorMode(HSB, 255);
  }

  @Override
  void display(float[] signals) {

    int numSignals = signals.length;

    background(0);
    rectMode(CENTER);
    noStroke();
    fill(255);

    translate(width / 2, height / 2);

    pushMatrix();
    scale(z0);


    // draw each ring
    for (int ringCount = 0; ringCount < size0; ringCount++) {
      int rectId = 0;

      if (colorPalette == 0) {
        fill(ringCount % 5 / 5.0 * 255, colorAdjustment, 255);
      }
      else if(colorPalette == 1) {
        fill((ringCount % 5 / 5.0 * 255 + millis() / 20.0) % 255, colorAdjustment, 255); 
      }

      // draw ring particles
      for (float i = 0; i < TWO_PI; i += TWO_PI / (20 * (ringCount + 1) / x0)) {
        pushMatrix();

        float rot = 0;
        if (mode == 1) {
          rot = i + millis() / 400.0 / ringRotationSpeed[ringCount] * speed;
        }
        else if (mode == 2){
          rot = (i / ringRotationSpeed[ringCount]) + millis() / 400.0 * speed;
        }
        else {
          rot = i + millis() / 400.0 * speed;
        }

        rotate(rot);

        if (!(mode == 3 && ringDisabled[ringCount])) {
          rect(20 * (ringCount + 1), 0, signals[rectId % numSignals] / 10.0 * size1, 3);
        }

        popMatrix();
        rectId++;
      }
    }

    popMatrix();
  }


  private void randomizeRingSettings() {
    int ringCount = (int)maxSize0;

    ringRotationSpeed = new float[ringCount];
    ringDisabled = new boolean[ringCount];

    for (int i = 0; i < ringCount; i++) {
      float rotSpeed = 1.0;
      boolean disabled = false;

      switch ((int)random(6)) {
        case 0:
          rotSpeed = 1.0;
          break;
        case 1:
          rotSpeed = -1.0;
          break;
        case 2:
          rotSpeed = 2.0;
          break;
        case 3:
          rotSpeed = -2.0;
          break;
        case 4:
          rotSpeed = 4.0;
          break;
        case 5:
          rotSpeed = -4.0;
          break;
      }
      ringRotationSpeed[i] = rotSpeed;

      if ((int)random(4) == 0) {
        disabled = true;
      }
      ringDisabled[i] = disabled;
    }
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
    println("size1 changed to " + size0);
    return size1;
  }


  @Override
  public float setX0(float value, boolean normalized) {
    x0 = normalized ? value : map(value, 0, 127, minX0, maxX0);
    println("x0 changed to " + x0);
    return x0;
  }


  @Override
  public float setZ0(float value, boolean normalized) {
    z0 = normalized ? value : map(value, 0, 127, minZ0, maxZ0);
    println("z0 changed to " + z0);
    return z0;
  }

  @Override
  public float setMode(float value, boolean normalized) {
    mode = normalized ? round(value) : round(map(value, 0, 127, 0, numModes - 1));
    println("mode changed to " + mode);
    return (float)mode;
  }

  @Override
  public float setSpeed(float value, boolean normalized) {
    speed = normalized ? value : map(value, 0, 127, minSpeed, maxSpeed);
    println("speed changed to " + speed);
    return speed;
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


}

