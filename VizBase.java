import processing.core.*;

public abstract class VizBase {
  protected PApplet parent;
  
  public VizBase(PApplet parentApplet) {
    this.parent = parentApplet;
  }
  
  public void init() {};
  
  public void display() {};
}