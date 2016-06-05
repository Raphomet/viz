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
  // public void setSpeed(float value, boolean normalized) {};
  public float setSize0(float value, boolean normalized) { return (float)0.0; }
  public float setSize1(float value, boolean normalized) { return (float)0.0; }
  public float setColorPalette(float value, boolean normalized) { return (float)0.0; }
  public float setColorAdjustment(float value, boolean normalized) { return (float)0.0; }
  public float setMode(float value, boolean normalized) { return (float)0.0; }
  public float setAlpha(float value, boolean normalized) { return (float)0.0; }
  // public void setX0(int value, boolean normalized) {};
  // public void setX1(int value, boolean normalized) {};
  // public void setY0(int value, boolean normalized) {};
  // public void setY1(int value, boolean normalized) {};
  // public void setZ0(int value, boolean normalized) {};
  // public void setZ1(int value, boolean normalized) {};


  // speed

  protected boolean usesSpeed = false;
  protected float defaultSpeed = 50;
  protected float speed = defaultSpeed;

  public void setSpeed(float _speed) {
    speed = _speed;
  }

  public boolean usesSpeed() {
    return usesSpeed;
  }

  public float getDefaultSpeed() {
    return defaultSpeed;
  }


  // size0
  protected boolean usesSize0  = false;
  protected float minSize0;
  protected float maxSize0;
  protected float defaultSize0;
  protected int size0Signal    = 0;

  public float getMinSize0()     { return minSize0; }
  public float getMaxSize0()     { return maxSize0; }
  public float getDefaultSize0() { return defaultSize0; }
  public boolean usesSize0()     { return usesSize0; }
  public int getSize0Signal()    { return size0Signal; }


  // size1
  protected boolean usesSize1  = false;
  protected float minSize1;
  protected float maxSize1;
  protected float defaultSize1;
  protected int size1Signal    = 0;

  public float getMinSize1()     { return minSize1; }
  public float getMaxSize1()     { return maxSize1; }
  public float getDefaultSize1() { return defaultSize1; }
  public boolean usesSize1()     { return usesSize1; }
  public int getSize1Signal()    { return size1Signal; }


  // color palette
  protected boolean usesColorPalette = false;
  protected int   numColorPalettes = 1;

  public boolean usesColorPalette() { return usesColorPalette; }
  public int getNumColorPalettes()  { return numColorPalettes; }


  // color adjustment
  protected boolean usesColorAdjustment  = false;
  protected float minColorAdjustment;
  protected float maxColorAdjustment;
  protected float defaultColorAdjustment;

  public boolean usesColorAdjustment() { return usesColorAdjustment; }
  public float getMinColorAdjustment() { return minColorAdjustment; }
  public float getMaxColorAdjustment() { return maxColorAdjustment; }
  public float getDefaultColorAdjustment() { return defaultColorAdjustment; }


  // mode
  protected boolean usesMode = false;
  protected int numModes = 1;

  public boolean usesMode() { return usesMode; }
  public int getNumModes()  { return numModes; }


  // alpha

  public void setAlphaSignal(int value) {};

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

