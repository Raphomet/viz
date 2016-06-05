/**
 * - must actually make this respond to music...
 *
 * Ideas:
 * - finish more planet types
 * - draw orbit trails, alpha it in
 * - orbit size pulses with music
 * - starfield background
 * - color planets
 * - prettify sun
 */

import processing.core.*;
import java.util.*;

public class Planets extends VizBase
{  
  public Planets(PApplet parentApplet) {
    super(parentApplet);
    name = "Planets";
  }
  

  List<Planet> planets = new ArrayList<Planet>();

  @Override
  public void init() {
    // setup

    // create planets here
    for (int i = 0; i < 30; i++) {
      planets.add(new Planet());
    }
  }

  @Override
  void display(float[] signals) {
    background(0);

    // draw a sun
    translate(width / 2, height / 2);
    ellipseMode(RADIUS);
    noFill();
    strokeWeight(8);
    stroke(255);
    ellipse(0, 0, 10, 10);

    // draw planets
    for (int i = 0; i < planets.size(); i++) {
      planets.get(i).display(frameCount / 100.0, (i + 1) * 10);
    }
  }

  // a planet has:
  //   - a, radius on x axis (normalized)
  //   - b, radius on y axis (normalized)
  //   - radius multiplier
  //   - rotational tilt
  //   - multiple draw modes
  //
  //   - color?
  //   - afterimage?
  //   - trail?
  class Planet {

    float a;
    float b;

    float rot;

    boolean clockwise;

    static final int TYPE_SIMPLE = 0;
    static final int TYPE_SIMPLE_WITH_MOON = 1;
    static final int TYPE_SIMPLE_WITH_TWO_MOONS = 2;
    static final int TYPE_SIMPLE_WITH_MOON_WITH_MOON = 3;
    static final int TYPE_SIMPLE_WITH_RING = 4;
    static final int TYPE_BINARY = 5;
    static final int TYPE_TRINARY = 6;
    int type;
    float radius;

    Moon moon;
    Moon moon2;

    public Planet() {

      a = random(1.2) + 0.25;
      b = random(1.2) + 0.25;
      radius = random(10) + 8;
      rot = random(1) * TWO_PI;

      clockwise = new Random().nextBoolean();

      type = (int)random(2);
      type = TYPE_SIMPLE_WITH_MOON;

      if (type == TYPE_SIMPLE_WITH_MOON) {
        moon = new Moon(false);
      }
    }

    // 
    void display(float t, float distance) {

      pushMatrix();
      rotate(rot);
      ellipseMode(RADIUS);

      switch (type) {
        case TYPE_SIMPLE_WITH_MOON:
          fill(255);
          noStroke();
          float x = x(t) * distance;
          float y = y(t) * distance;
          ellipse(x, y, radius, radius);
          moon.display(t, x, y, radius);
          break;
        default: // TYPE_SIMPLE
          fill(255);
          noStroke();
          ellipse(x(t) * distance, y(t) * distance, radius, radius);
          break;
      }

      popMatrix();
    }

    private float x(float t) {
      int direction = clockwise ? 1 : -1;
      return a * cos(t) * direction;
    }

    private float y(float t) {
      return b * sin(t);
    }

    class Moon {
      float a;
      float b;

      float radius;
      boolean clockwise;

      Moon moon;

      public Moon(boolean hasMoon) {
        a = random(1.2) + 0.25;
        b = random(1.2) + 0.25;

        radius = random(4) + 2;

        clockwise = new Random().nextBoolean();

        if (hasMoon) {
          moon = new Moon(false);
        }
      }

      void display(float t, float centerX, float centerY, float bodyRadius) {
        // TODO: draw moon that orbits around centerX and centerY

        // fill(255, 0, 0);
        noFill();
        strokeWeight(2);
        stroke(128, 128, 128);
        ellipse(x(t) * (bodyRadius + 20) + centerX, y(t) * (bodyRadius + 20) + centerY, radius, radius);

        if (moon != null) {
          // TODO: draw submoon
        }
      }

      private float x(float t) {
        int direction = clockwise ? 1 : -1;
        return a * cos(t) * direction;
      }

      private float y(float t) {
        return b * sin(t);
      }

    }


  }



}

