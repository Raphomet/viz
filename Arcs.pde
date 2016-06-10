import processing.core.*;
import java.util.*;

public class Arcs extends VizBase
{  
  public Arcs(PApplet parentApplet) {
    super(parentApplet);
    name = "Arcs";

    usesColorPalette = true;
    numColorPalettes = 3;

    usesColorAdjustment = true;
    minColorAdjustment = 0;
    maxColorAdjustment = 255;
    defaultColorAdjustment = 0;
    colorAdjustment = defaultColorAdjustment;

    // number of arcs
    usesSize0 = true;
    minSize0 = 1;
    maxSize0 = 40;
    defaultSize0 = 1;
    size0 = defaultSize0;

    // base line thickness
    usesSize1 = true;
    minSize1 = 0.1;
    maxSize1 = 10;
    defaultSize1 = 4;
    size1 = defaultSize1;

    // sensitivity
    usesSensitivity = true;
    minSensitivity = 0;
    maxSensitivity = 1;
    defaultSensitivity = 0.5;
    sensitivity = defaultSensitivity;

    usesMode = true;
    numModes = 1;

    // arc completion speed
    usesSpeed = true;
    minSpeed = 0.01;
    maxSpeed = 2;
    defaultSpeed = 1;
    speed = defaultSpeed;

    // cell count
    usesX0 = true;
    minX0 = 1;
    maxX0 = 8;
    defaultX0 = 1;
    x0 = defaultX0;

    // delay between arcs
    usesX1 = true;
    minX1 = -500;
    maxX1 = 500;
    defaultX1 = 0;
    x1 = defaultX1;

    usesY0 = true;
    minY0 = 25;
    maxY0 = 100;
    defaultY0 = 50;
    y0 = defaultY0;

    usesY1 = true;
    minY1 = 0;
    maxY1 = 400;
    defaultY1 = 100;
    y1 = defaultY1;


    // delay between ArcSets along i
    usesZ0 = true;
    minZ0 = 0;
    maxZ0 = 1000;
    defaultZ0 = 100;
    z0 = defaultZ0;

    // delay between ArcSets along j
    usesZ1 = true;
    minZ1 = 0;
    maxZ1 = 1000;
    defaultZ1 = 100;
    z1 = defaultZ1;
  }
  

  List<List<ArcSet>> arcSetGrid;

  @Override
  public void init() {
    arcSetGrid = new ArrayList<List<ArcSet>>();

    for (int j = 0; j < maxX0; j++) {
      arcSetGrid.add(new ArrayList<ArcSet>());
      for (int i = 0; i < maxX0; i++) {
        arcSetGrid.get(j).add(new ArcSet(i, j));
      }
    }

    colorMode(HSB, 255);
  }

  @Override
  void display(float[] signals) {

    background(0);
    pushMatrix();

    translate(width / 2 - (((int)x0 - 1) * y1) / 2, height / 2 - (((int)x0 - 1) * y1) / 2);

    for (int j = 0; j < (int)x0; j++) {
      float y = j * y1;
      for (int i = 0; i < (int)x0; i++) {
        float x = i * y1;

        pushMatrix();
        translate(x, y);
        ArcSet currentArcSet = arcSetGrid.get(i).get(j);
        currentArcSet.display(signals);

        popMatrix();
      }
    }


    popMatrix();
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
  public float setX1(float value, boolean normalized) {
    x1 = normalized ? value : map(value, 0, 127, minX1, maxX1);
    println("x1 changed to " + x1);
    return x1;
  }

  @Override
  public float setY0(float value, boolean normalized) {
    y0 = normalized ? value : map(value, 0, 127, minY0, maxY0);
    println("y0 changed to " + y0);
    return y0;
  }

  @Override
  public float setY1(float value, boolean normalized) {
    y1 = normalized ? value : map(value, 0, 127, minY1, maxY1);
    println("y1 changed to " + y1);
    return y1;
  }


  @Override
  public float setZ0(float value, boolean normalized) {
    z0 = normalized ? value : map(value, 0, 127, minZ0, maxZ0);
    println("z0 changed to " + z0);
    return z0;
  }

  @Override
  public float setZ1(float value, boolean normalized) {
    z1 = normalized ? value : map(value, 0, 127, minZ1, maxZ1);
    println("z1 changed to " + z1);
    return z1;
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
  public float setSensitivity(float value, boolean normalized) {
    sensitivity = normalized ? value : map(value, 0, 127, minSensitivity, maxSensitivity);
    println("sensitivity changed to " + sensitivity);
    return sensitivity;
  }



  class ArcSet {

    int i;
    int j;

    public ArcSet(int _i, int _j) {
      i = _i;
      j = _j;
    }

    void display(float[] signals) {

      pushMatrix();
      rotate(3 * HALF_PI);

      if (colorPalette == 0) {
        stroke(255);
      }
      else if(colorPalette == 2) {
        stroke(colorAdjustment, 255, 255 * ((x0 - i) / x0));
      }

      // draw each arc
      for (int k = 0; k < size0; k++) {
        noFill();
        strokeWeight(size1 + signals[k % 9] * sensitivity / 5.0);

        if (colorPalette == 1) {
          stroke(colorAdjustment, 255, 255 * ((size0 - k) / size0));
        }

        if ((int)((millis() * speed) + (x1 * k) + (z0 * i) + (z1 * j)) / 1000 % 2 == 0) {
          arc(0, 0, y0 * (k + 1), y0 * (k + 1), 0, TWO_PI * (((millis() * speed) + (x1 * k) + (z0 * i) + (z1 * j)) % 1000) / 1000.0);
        }
        else {
          arc(0, 0, y0 * (k + 1), y0 * (k + 1), TWO_PI * (((millis() * speed) + (x1 * k) + (z0 * i) + (z1 * j)) % 1000) / 1000.0, TWO_PI);
        }
      }

      popMatrix();
    }
  }



}

