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


    int controlGridLeftX          = 350;
    int controlGridUpY            = 50;
    int controlGridSectionWidth   = 200;
    int controlGridSectionHeight  = 100;
    int controlGridSectionLabelOffset = -5;
    int controlGridSectionSpacing = 25;



    // fft adjustment controls
    cp5.addSlider("expBase")
      .setPosition(20, 140)
      .setSize(200, 20)
      .setRange(0, 3) // TODO: refactor this somewhere or get it from parent
      .changeValue(expBase);

    cp5.addSlider("signalScale")
      .setPosition(20, 180)
      .setSize(200, 20)
      .setRange((float)0.5, 8)
      .changeValue(signalScale);



    // TODO: BPM

    // speed

    cp5.addKnob("speed")
      .setRange(0,127)
      .setPosition(20,220)
      .setRadius(50)
      .setDragDirection(Knob.VERTICAL)
      .changeValue(50);




    // add control boxes


    cp5.addTextlabel("size1SectionLabel")
      .setText("SIZE 1")
      .setPosition(controlGridLeftX, controlGridUpY);

    cp5.addTextlabel("size1Channel")
      .setText("channel")
      .setPosition(controlGridLeftX, controlGridUpY + controlGridSectionSpacing + controlGridSectionLabelOffset);

    cp5.addScrollableList("size1Signal")
       .setPosition(controlGridLeftX + 50, controlGridUpY + controlGridSectionSpacing)
       .setSize(30, 300)
       .setBarHeight(20)
       .setItemHeight(20)
       .setOpen(false)
       .addItems(java.util.Arrays.asList("0","1","2","3","4","5","6","7","8"))
       .changeValue(0);

    cp5.addTextlabel("size1Value")
      .setText("value")
      .setPosition(controlGridLeftX, controlGridUpY + controlGridSectionSpacing * 2 + controlGridSectionLabelOffset);

    cp5.addSlider("size1")
      .setLabelVisible(true)
      .setPosition(controlGridLeftX + 50, controlGridUpY + controlGridSectionSpacing * 2)
      .setSize(100, 20)
      .setRange(0, 255)
      .changeValue(50);



    // size0

    cp5.addTextlabel("size0SectionLabel")
      .setText("SIZE 0")
      .setPosition(controlGridLeftX, controlGridSectionHeight + controlGridUpY);

    cp5.addTextlabel("size0Channel")
      .setText("channel")
      .setPosition(controlGridLeftX, controlGridSectionHeight + controlGridUpY + controlGridSectionSpacing + controlGridSectionLabelOffset);

    cp5.addScrollableList("size0Signal")
       .setPosition(controlGridLeftX + 50, controlGridSectionHeight + controlGridUpY + controlGridSectionSpacing)
       .setSize(30, 300)
       .setBarHeight(20)
       .setItemHeight(20)
       .setOpen(false)
       .addItems(java.util.Arrays.asList("0","1","2","3","4","5","6","7","8"))
       .changeValue(0);

    cp5.addTextlabel("size0Value")
      .setText("value")
      .setPosition(controlGridLeftX, controlGridSectionHeight + controlGridUpY + controlGridSectionSpacing * 2 + controlGridSectionLabelOffset);

    cp5.addSlider("size0")
      .setLabelVisible(true)
      .setPosition(controlGridLeftX + 50, controlGridSectionHeight + controlGridUpY + controlGridSectionSpacing * 2)
      .setSize(100, 20)
      .setRange(0, 255)
      .changeValue(50);



    // color adjustment


    cp5.addTextlabel("colorAdjustmentSectionLabel")
      .setText("COLOR ADJUSTMENT")
      .setPosition(controlGridLeftX + controlGridSectionWidth, controlGridUpY);

    cp5.addTextlabel("colorAdjustmentValue")
      .setText("value")
      .setPosition(controlGridLeftX + controlGridSectionWidth, controlGridUpY + controlGridSectionSpacing + controlGridSectionLabelOffset);

    cp5.addSlider("colorAdjustment")
      .setLabelVisible(true)
      .setPosition(controlGridLeftX + controlGridSectionWidth + 50, controlGridUpY + controlGridSectionSpacing)
      .setSize(100, 20)
      .setRange(0, 1)
      .changeValue(0);


    // color palettes
    // TODO: try ticks?

    cp5.addTextlabel("colorPaletteSectionLabel")
      .setText("COLOR PALETTE")
      .setPosition(controlGridLeftX + controlGridSectionWidth, controlGridSectionHeight + controlGridUpY);

    cp5.addTextlabel("colorPaletteValue")
      .setText("value")
      .setPosition(controlGridLeftX + controlGridSectionWidth, controlGridSectionHeight + controlGridUpY + controlGridSectionSpacing + controlGridSectionLabelOffset);

    cp5.addSlider("colorPalette")
      .setLabelVisible(true)
      .setPosition(controlGridLeftX + controlGridSectionWidth + 50, controlGridSectionHeight + controlGridUpY + controlGridSectionSpacing)
      .setSize(100, 20)
      .setRange(0, 1)
      .changeValue(0);


    // alpha

    cp5.addTextlabel("alphaSectionLabel")
      .setText("ALPHA")
      .setPosition(controlGridLeftX + 2 * controlGridSectionWidth, controlGridUpY);

    cp5.addTextlabel("alphaChannel")
      .setText("channel")
      .setPosition(controlGridLeftX + 2 * controlGridSectionWidth, controlGridUpY + controlGridSectionSpacing + controlGridSectionLabelOffset);

    cp5.addScrollableList("alphaSignal")
       .setPosition(controlGridLeftX + 2 * controlGridSectionWidth + 50, controlGridUpY + controlGridSectionSpacing)
       .setSize(30, 300)
       .setBarHeight(20)
       .setItemHeight(20)
       .setOpen(false)
       .addItems(java.util.Arrays.asList("0","1","2","3","4","5","6","7","8"))
       .changeValue(0);

    cp5.addTextlabel("alphaValue")
      .setText("value")
      .setPosition(controlGridLeftX + 2 * controlGridSectionWidth, controlGridUpY + controlGridSectionSpacing * 2 + controlGridSectionLabelOffset);

    cp5.addSlider("alpha")
      .setLabelVisible(true)
      .setPosition(controlGridLeftX + 2 * controlGridSectionWidth + 50, controlGridUpY + controlGridSectionSpacing * 2)
      .setSize(100, 20)
      .setRange(0, 255)
      .changeValue(50);


    // mode

    cp5.addTextlabel("modeSectionLabel")
      .setText("MODE")
      .setPosition(controlGridLeftX + 2 * controlGridSectionWidth, controlGridSectionHeight + controlGridUpY);

    cp5.addTextlabel("modeValue")
      .setText("value")
      .setPosition(controlGridLeftX + 2 * controlGridSectionWidth, controlGridSectionHeight + controlGridUpY + controlGridSectionSpacing + controlGridSectionLabelOffset);

    cp5.addSlider("mode")
      .setLabelVisible(true)
      .setPosition(controlGridLeftX + 2 * controlGridSectionWidth + 50, controlGridSectionHeight + controlGridUpY + controlGridSectionSpacing)
      .setSize(100, 20)
      .setRange(0, 1)
      .changeValue(0);






    // end of controls

    cp5.addScrollableList("currentViz")
       .setPosition(350, 20)
       .setSize(300, 300)
       .setBarHeight(20)
       .setItemHeight(20)
       .setOpen(false)
       .addItems(appNames)
       .setValue(0); // has side effect: initializes app controls for sketch

    // initializeAppControls(parent.getCurrentSketch());
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
    VizBase sketch  = parent.getCurrentSketch();
    float value  = c.getValue();

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
        parent.setSelected(selectedIndex);
        break;
      case "alphaSignal":
        sketch.setAlphaSignal((int)value);
        break;
      case "alpha":
        sketch.setAlpha(value, true);
        break;
        // TODO: size0, size1 SIGNALS
      case "size0":
        sketch.setSize0(value, true);
        break;
      case "size1":
        sketch.setSize1(value, true);
        break;
      case "colorPalette":
        sketch.setColorPalette(value, true);
        break;
      case "mode":
        sketch.setMode(value, true);
        break;
      case "colorAdjustment":
        sketch.setColorAdjustment(value, true);
        break;
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

    if (sketch.usesSize0()) {
      Slider cSize0 = (Slider)cp5.getController("size0");
      cSize0.setRange(sketch.getMinSize0(), sketch.getMaxSize0());
      setSize0(sketch.getDefaultSize0());
    }

    if (sketch.usesSize1()) {
      Slider cSize1 = (Slider)cp5.getController("size1");
      cSize1.setRange(sketch.getMinSize1(), sketch.getMaxSize1());
      setSize1(sketch.getDefaultSize1());
    }

    if (sketch.usesColorPalette()) {
      Slider cColorPalette = (Slider)cp5.getController("colorPalette");
      cColorPalette.setRange(0, sketch.getNumColorPalettes() - 1);
      setColorPalette(0); // 0 is always default for color palette
    }

    if (sketch.usesMode()) {
      Slider cMode = (Slider)cp5.getController("mode");
      cMode.setRange(0, sketch.getNumModes() - 1);
      setMode(0); // 0 is always default for mode
    }

    if (sketch.usesColorAdjustment()) {
      Slider cColorAdjustment = (Slider)cp5.getController("colorAdjustment");
      cColorAdjustment.setRange(sketch.getMinColorAdjustment(), sketch.getMaxColorAdjustment());
      setColorAdjustment(sketch.getDefaultColorAdjustment());
    }

    if (sketch.usesAlpha()) {
      Slider cAlpha = (Slider)cp5.getController("alpha");
      cAlpha.setRange(sketch.getMinAlpha(), sketch.getMaxAlpha());
      setAlpha(sketch.getDefaultAlpha());
    }
  }

  void setSpeed(float value) {
    cp5.getController("speed").changeValue(value);
  }

  void setSize0(float value) {
    cp5.getController("size0").changeValue(value);
  }

  void setSize1(float value) {
    cp5.getController("size1").changeValue(value);
  }

  void setColorAdjustment(float value) {
    cp5.getController("colorAdjustment").changeValue(value);
  }

  void setColorPalette(float value) {
    cp5.getController("colorPalette").changeValue(value);
  }

  void setMode(float value) {
    cp5.getController("mode").changeValue(value);
  }

  void setAlpha(float value) {
    cp5.getController("alpha").changeValue(value);
  }
}