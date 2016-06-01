import processing.core.*;

public class BlueSquare extends VizBase
{
  private PVector p;
  
  public BlueSquare(PApplet parentApplet) {
    super(parentApplet);
  }
  
  @Override
  public void init() {
    p = new PVector(parent.width / 2, parent.height / 2, 0);
  }
  
  @Override
  public void display() {
    parent.background(255);
    parent.stroke(0,0,255);
    parent.fill(255);
    parent.rect(p.x, p.y, 50, 50);
  }
}