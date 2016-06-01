import processing.core.*;

public class RedCircle extends VizBase
{
  private PVector p;
  
  public RedCircle(PApplet parentApplet) {
    super(parentApplet);
  }
  
  @Override
  public void init() {
    p = new PVector(parent.width / 2, parent.height / 2, 0);
  }
  
  @Override
  public void display() {
    parent.noStroke();
    parent.background(255);
    parent.fill(255,0,0);
    parent.ellipse(p.x, p.y, 50, 50);
  }
}