import processing.core.*;
import controlP5.*;

public abstract class VizBase {
  protected PApplet parent;
  protected ControlFrame cf;
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

  public void setControlFrame(ControlFrame _cf) {
    cf = _cf;
  }

  // controls
  // the sketch is responsible for remapping the value (0-127 from nanokontrol2)
  // to something that makes sense within its own domain.
  // public void setBpm(int value, boolean normalized) {};
  // public void setSpeed(int value, boolean normalized) {};
  // public void setSize0(int value, boolean normalized) {};
  // public void setSize1(int value, boolean normalized) {};
  // public void setColorPalette(int value, boolean normalized) {};
  // public void setColorAdjustment(int value, boolean normalized) {};
  // public void setMode(int value, boolean normalized) {};
  public float setAlpha(float value, boolean normalized) { return (float)0.0; };
  // public void setX0(int value, boolean normalized) {};
  // public void setX1(int value, boolean normalized) {};
  // public void setY0(int value, boolean normalized) {};
  // public void setY1(int value, boolean normalized) {};
  // public void setZ0(int value, boolean normalized) {};
  // public void setZ1(int value, boolean normalized) {};

  public void setAlphaSignal(int value) {};
  // public void setAlphaSignal(int value) {};

  protected boolean usesAlpha = false;
  protected float minAlpha;
  protected float maxAlpha;
  protected float defaultAlpha;
  protected int alphaSignal = 0;

  public float getMinAlpha() {
    return minAlpha;
  }

  public float getMaxAlpha() {
    return maxAlpha;
  }

  public float getDefaultAlpha() {
    return defaultAlpha;
  }

  public boolean usesAlpha() {
    return usesAlpha;
  }

  public int getAlphaSignal() {
    return alphaSignal;
  }


  public void resetControls() {
    // setBpm(0);
    // setSpeed(0);
    // setSize0(0);
    // setSize1(0);
    // setColorPalette(0);
    // setColorAdjustment(0);
    // setMode(0);
    // setAlpha(0);
    // setX0(0);
    // setX1(0);
    // setY0(0);
    // setY1(0);
    // setZ0(0);
    // setZ1(0);
  };
}




// template

// import processing.core.*;

// public class VizName extends VizBase
// {  
//   public VizName(PApplet parentApplet) {
//     super(parentApplet);
//     name = "My Viz";
//   }
  
//   @Override
//   public void init() {
//     // setup
//   }

//   @Override
//   void display(float[] signals) {
//     // draw
//   }
// }

