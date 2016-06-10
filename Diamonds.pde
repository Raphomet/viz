import processing.core.*;

public class Diamonds extends VizBase
{  
  public Diamonds(PApplet parentApplet) {
    super(parentApplet);
    name = "Diamonds";
  }
  
  @Override
  public void init() {
  }

  @Override
  void display(float[] signals) {

    background(0);
    rectMode(CENTER);
    noStroke();
    fill(255);

    translate(width / 2, height / 2);

    for (int ringCount = 0; ringCount < 30; ringCount++) {
      for (float i = 0; i < TWO_PI; i += TWO_PI / (20 * (ringCount + 1))) {
        // draw rectangles
        pushMatrix();
        rotate(i + millis() / 400.0);
        rect(20 * (ringCount + 1), 0, 10, 3);
        popMatrix();
      }
    }
  }
}

