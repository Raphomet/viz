import processing.core.*;
import controlP5.*;

public abstract class VizBase {
  // TODO: move shared color palettes in here
  // TODO: move var setter methods in here

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
  public void setDisplayText(String displayText) {};
  public float setSpeed(float value, boolean normalized) { return (float) 0.0; }
  public float setSensitivity(float value, boolean normalized) { return (float) 0.0; }
  public float setSize0(float value, boolean normalized) { return (float)0.0; }
  public float setSize1(float value, boolean normalized) { return (float)0.0; }
  public float setColorPalette(float value, boolean normalized) { return (float)0.0; }
  public float setColorAdjustment(float value, boolean normalized) { return (float)0.0; }
  public float setMode(float value, boolean normalized) { return (float)0.0; }
  public float setAlpha(float value, boolean normalized) { return (float)0.0; }
  public float setX0(float value, boolean normalized) { return (float)0.0; }
  public float setX1(float value, boolean normalized) { return (float)0.0; }
  public float setY0(float value, boolean normalized) { return (float)0.0; }
  public float setY1(float value, boolean normalized) { return (float)0.0; }
  public float setZ0(float value, boolean normalized) { return (float)0.0; }
  public float setZ1(float value, boolean normalized) { return (float)0.0; }

  public void buttonShuffleColorsPressed() { };
  public void buttonResetSpeedPressed() { };


  protected String displayText;
  protected float alpha;
  protected float size0;
  protected float size1;
  protected int colorPalette = 0;
  protected float colorAdjustment;
  protected int mode = 0;
  protected float speed;
  protected float sensitivity;
  protected float x0;
  protected float x1;
  protected float y0;
  protected float y1;
  protected float z0;
  protected float z1;



  // displayText
  protected boolean usesDisplayText = false;
  protected String defaultDisplayText = "YO";

  public boolean usesDisplayText() { return usesDisplayText; }
  public String getDefaultDisplayText() { return defaultDisplayText; }


  // speed

  protected boolean usesSpeed = false;
  protected float minSpeed;
  protected float maxSpeed;
  protected float defaultSpeed;

  public boolean usesSpeed() { return usesSpeed; }
  public float getDefaultSpeed() { return defaultSpeed; }
  public float getMinSpeed() { return minSpeed; }
  public float getMaxSpeed() { return maxSpeed; }


  // sensitivity

  protected boolean usesSensitivity = false;
  protected float minSensitivity;
  protected float maxSensitivity;
  protected float defaultSensitivity;

  public boolean usesSensitivity() { return usesSensitivity; }
  public float getDefaultSensitivity() { return defaultSensitivity; }
  public float getMinSensitivity() { return minSensitivity; }
  public float getMaxSensitivity() { return maxSensitivity; }




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


  protected boolean usesX0 = false;
  protected float minX0;
  protected float maxX0;
  protected float defaultX0;

  public boolean usesX0() { return usesX0; }
  public float getDefaultX0() { return defaultX0; }
  public float getMinX0() { return minX0; }
  public float getMaxX0() { return maxX0; }

  protected boolean usesX1 = false;
  protected float minX1;
  protected float maxX1;
  protected float defaultX1;

  public boolean usesX1() { return usesX1; }
  public float getDefaultX1() { return defaultX1; }
  public float getMinX1() { return minX1; }
  public float getMaxX1() { return maxX1; }

  protected boolean usesY0 = false;
  protected float minY0;
  protected float maxY0;
  protected float defaultY0;

  public boolean usesY0() { return usesY0; }
  public float getDefaultY0() { return defaultY0; }
  public float getMinY0() { return minY0; }
  public float getMaxY0() { return maxY0; }

  protected boolean usesY1 = false;
  protected float minY1;
  protected float maxY1;
  protected float defaultY1;

  public boolean usesY1() { return usesY1; }
  public float getDefaultY1() { return defaultY1; }
  public float getMinY1() { return minY1; }
  public float getMaxY1() { return maxY1; }

  protected boolean usesZ0 = false;
  protected float minZ0;
  protected float maxZ0;
  protected float defaultZ0;

  public boolean usesZ0() { return usesZ0; }
  public float getDefaultZ0() { return defaultZ0; }
  public float getMinZ0() { return minZ0; }
  public float getMaxZ0() { return maxZ0; }

  protected boolean usesZ1 = false;
  protected float minZ1;
  protected float maxZ1;
  protected float defaultZ1;

  public boolean usesZ1() { return usesZ1; }
  public float getDefaultZ1() { return defaultZ1; }
  public float getMinZ1() { return minZ1; }
  public float getMaxZ1() { return maxZ1; }





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

