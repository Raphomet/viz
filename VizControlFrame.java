import processing.core.*;
import controlP5.*;
import java.util.*;


class ControlFrame extends PApplet {

  int w, h;
  viz parent; // ugh
  ControlP5 cp5;

  float visualScale = 1;

  float expBase;
  float signalScale;

  List<String> appNames;

  float[] signals;

  public ControlFrame(viz _parent, int _w, int _h, String _name, float defaultExpBase, float defaultSignalScale, List<String> _appNames) {
    super();   
    parent = _parent;
    w=_w;
    h=_h;

    expBase = defaultExpBase;
    signalScale = defaultSignalScale;
    appNames = _appNames;

    PApplet.runSketch(new String[]{this.getClass().getName()}, this);
  }

  public void settings() {
    size(w, h);
  }

  public void setup() {
    surface.setLocation(800, 100);
    cp5 = new ControlP5(this);

    // fft adjustment controls
    cp5.addSlider("expBase")
      .setPosition(20, 140)
      .setSize(200, 20)
      .setValue(expBase)
      .setRange(0, 3); // TODO: refactor this somewhere or get it from parent

    cp5.addSlider("signalScale")
      .setPosition(20, 180)
      .setSize(200, 20)
      .setRange((float)0.5, 8)
      .setValue(signalScale);

    // TODO: viz switcher
    cp5.addScrollableList("currentViz")
       .setPosition(350, 20)
       .setSize(300, 300)
       .setBarHeight(20)
       .setItemHeight(20)
       .setOpen(false)
       .addItems(appNames)
       .changeValue(0); // don't set value, or we'll try to initialize controls that aren't set up yet

    // add control boxes
    cp5.addTextlabel("alphaSectionLabel")
      .setText("ALPHA")
      .setPosition(350, 50);

    cp5.addTextlabel("alphaChannel")
      .setText("channel")
      .setPosition(350, 75);

    cp5.addScrollableList("alphaSignal")
       .setPosition(400, 70)
       .setSize(30, 300)
       .setBarHeight(20)
       .setItemHeight(20)
       .setOpen(false)
       .addItems(java.util.Arrays.asList("0","1","2","3","4","5","6","7","8"))
       .setValue(0);

    cp5.addTextlabel("alphaValue")
      .setText("value")
      .setPosition(350, 95);

    cp5.addSlider("alpha")
      .setLabelVisible(true)
      .setPosition(400, 90)
      .setSize(100, 20)
      .setRange(0, 255)
      .setValue(50);
 
    // now initialize everything
    initializeAppControls(parent.getCurrentSketch());
  }

  public void setSignals(float[] _signals) {
    signals = _signals;
  }

  public void draw() {
    background(0);

    // wait for master class's draw() to populate signals
    if (signals == null) {
      return;
    }

    // draw FFT area

    int fftWidth = 300;
    int fftHeight = 100;

    pushMatrix();
    translate(20, 20);
    for (int i = 0; i < signals.length; i++) {

      rectMode(CORNERS);

      float boxWidth = fftWidth / signals.length;
      
      int xl = (int)(boxWidth * i);
      int xr = (int)(boxWidth * (i + 1) - 1);
      
      // if the mouse is inside of this average's rectangle
      // print the center frequency and set the fill color to red
      if (mouseX >= xl && mouseX < xr) {
        // fill(255, 128);
        // text("Average Center Frequency: " + fft.getAverageCenterFrequency(i), 5, 25);
        fill(255, 0, 0);
      }
      else {
        fill(255);
      }

      // draw a rectangle for each signal value
      noStroke();
      rect(xl, fftHeight, xr, fftHeight - signals[i] * visualScale);

      // label each rectangle 
      fill(128);
      text(i, xl + 12, fftHeight - 8);
    }

    // draw constraint
    strokeWeight(1);
    stroke(255, 0, 0);
    line(0, 0, fftWidth, 0);

    popMatrix();
  }

  public void controlEvent(ControlEvent theEvent) {
    println("control event " + theEvent.getController().getName());

    Controller c = theEvent.getController();
    VizBase v    = parent.getCurrentSketch();

    switch(theEvent.getController().getName()) {
      case "expBase":
        expBase = theEvent.getController().getValue();
        parent.setExpBase(expBase);
        break;
      case "signalScale":
        signalScale = theEvent.getController().getValue();
        parent.setSignalScale(signalScale);
        break;
      case "currentViz":
        int selectedIndex = (int)theEvent.getController().getValue();
        // selected = selectedIndex;
        // TODO: set all controllers to viz defaults

        parent.setSelected(selectedIndex);
        break;
      case "alphaSignal":
        v.setAlphaSignal((int)c.getValue());
        break;
      case "alpha":
        // v.setAlpha()
    }
  }


  public void setExpBase(float value) {
    expBase = value;
    cp5.getController("expBase").changeValue(value);
  }

  public void setSignalScale(float value) {
    signalScale = value;
    cp5.getController("signalScale").changeValue(value);
  }

  public void initializeAppControls(VizBase sketch) {
    // read in the stuff
    // alpha:
    // - TODO: is it used by this sketch?
    if (sketch.usesAlpha()) {
      Slider c = (Slider)cp5.getController("alpha");
      c.setRange(sketch.getMinAlpha(), sketch.getMaxAlpha());
      println("setting range: " + sketch.getMinAlpha() + " to " + sketch.getMaxAlpha());
      setAlpha(sketch.getDefaultAlpha());
    }
  }

  void setAlpha(float value) {
    cp5.getController("alpha").changeValue(value);
  }
}