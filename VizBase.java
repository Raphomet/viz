import processing.core.*;

public abstract class VizBase {
  protected PApplet parent;

  protected String name;
  
  public VizBase(PApplet parentApplet) {
    this.parent = parentApplet;
  }

  // override this
  // call from setup
  public void init() {};
  
  // override this
  // call from draw
  public void display(float[] signals) {};

  public String getName() {
    return name;
  };
}