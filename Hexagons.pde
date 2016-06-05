import processing.core.*;

public class Hexagons extends VizBase
{  
  Gon[][] gons;

  public Hexagons(PApplet parentApplet) {
    super(parentApplet);
    name = "Hexagons";
  }
  
  @Override
  public void init() {
    background(0);

    gons = new Gon[5][5];

    for (int i = 0; i < 5; i++) {
      for (int j = 0; i < 5; i++) {
        gons[i][j] = new Gon();
      }
    }

  }

  @Override
  void display(float[] signals) {
    float x = 0;
    float y = 0;

    for (int i = 0; i < 5; i++) {
      for (int j = 0; j < 5; j++) {
        Gon gon = gons[i][j];

        float y2 = y;
        if (x % 2 == 1) {
          y2 += 50;
        }
        gon.display(x, y2, 40);
        println(i + " " + j + " " + x + " " + y2);

        y += 100;
      }
      x += 100;
    }

  }

  class Gon {

    color myColor;

    public Gon() {
      myColor = #ff0000;
    }

    // some shit
    void display(float centerX, float centerY, float radius) {
      float angle = TWO_PI / 6;
      beginShape();
      for (float a = 0; a < TWO_PI; a += angle) {
        float sx = centerX + cos(a) * radius;
        float sy = centerY + sin(a) * radius;
        vertex(sx, sy);
      }
      endShape(CLOSE);
    }

  }
}

