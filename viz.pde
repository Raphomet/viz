import ddf.minim.analysis.*;
import ddf.minim.*;
import controlP5.*;
import java.util.*;

Minim minim;
FFT fft;

// line in vs. file
AudioInput  in;
// AudioPlayer in;

// FFT parameters
int bufferSize = 512;
int fftBaseFrequency = 86;
int fftBandsPerOctave = 1;

// song-dependent variables
String filePath       = "/Users/raph/Music/iTunes/iTunes Music/Simian Mobile Disco/Bugged Out_ Suck My Deck/01 Joakim - Drumtrax.mp3";
int startPosition     = 30000; // milliseconds

float defaultExpBase         = 1.75; // exponent base for "amplifying" band values
float expBase = defaultExpBase;

float defaultSignalScale     = 4;
float signalScale = defaultSignalScale;

WindowFunction defaultWindow = FFT.HAMMING;
WindowFunction window = defaultWindow;

ControlFrame cf;
int cfWidth = 1000;
int cfHeight = 600;

float[] signals;

ArrayList<VizBase> apps;
int selected;

void setup() {
  size(640, 640);
  surface.setSize(640, 640);
  surface.setLocation(100, 100);

  // set up minim/FFT
  minim = new Minim(this);

  // if using line in
  in = minim.getLineIn(Minim.STEREO, 512);

  // if using file
  // in = minim.loadFile(filePath, bufferSize);
  // in.play(startPosition);
    
  fft = new FFT(in.bufferSize(), in.sampleRate());
  fft.logAverages(fftBaseFrequency, fftBandsPerOctave);

  if(window != null) {
    fft.window(FFT.HAMMING); // TODO: change possible windowing functions
  }


  //creating an instance of our list
  apps = new ArrayList<VizBase>();
  
  //adding each of our nested Applets to the list.
  apps.add(new ParametricLines(this));
  apps.add(new Jags(this));
  apps.add(new DotMatrix(this));
  
  //calling the initialization function on each
  //Applet in the list.
  for(VizBase a : apps) {
    a.init();
  }
  
  selected = 0;

  // set up control panel
  cf = new ControlFrame(this, cfWidth, cfHeight, "Controls");
}

void draw() {
  signals = getAdjustedFftSignals();
  apps.get(selected).display(signals);
}

/**
 * Here we use key presses to determine which
 * app to display. 
 **/
// void keyPressed() {
//   if(key == '0') {
//     selected = 0;
//   }
//   if(key == '1') {
//     selected = 1;
//   }
// }

// Boost FFT signals in each band, constrain them to a ceiling.
// Return adjusted results in array.
float[] getAdjustedFftSignals() {
  float[] signals = new float[fft.avgSize()];

  fft.forward(in.mix);
  for(int i = 0; i < fft.avgSize(); i++) {
    // adjust and constrain signal value
    float adjustedAvg    = fft.getAvg(i) * pow(expBase, i) * signalScale;
    float constrainedAvg = constrain(adjustedAvg, 0, 100);

    signals[i] = constrainedAvg;
  }

  return signals;
}








class ControlFrame extends PApplet {

  int w, h;
  PApplet parent;
  ControlP5 cp5;

  float visualScale = 1;

  public ControlFrame(PApplet _parent, int _w, int _h, String _name) {
    super();   
    parent = _parent;
    w=_w;
    h=_h;
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
      .setValue(defaultExpBase)
      .setRange(0, 3);

    cp5.addSlider("signalScale")
      .setPosition(20, 180)
      .setSize(200, 20)
      .setRange(0.5, 8)
      .setValue(defaultSignalScale);

    // viz switcher
    List<String> appNames = new ArrayList<String>();
    for (VizBase app : apps) {
      appNames.add(app.getName());
    }
    println(appNames);
    cp5.addScrollableList("currentViz")
       .setPosition(350, 20)
       .setSize(300, 300)
       .setBarHeight(20)
       .setItemHeight(20)
       .setOpen(false)
       .addItems(appNames)
       .setValue(0);


    // add control boxes
    cp5.addTextlabel("alpha")
      .setText("ALPHA")
      .setPosition(350, 50);

    cp5.addScrollableList("alphaChannel")
       .setPosition(350, 80)
       .setSize(100, 300)
       .setBarHeight(20)
       .setItemHeight(20)
       .setOpen(false)
       .addItems(java.util.Arrays.asList("0","1","2","3","4","5","6","7","8"))
       .setValue(0);
  }

  void draw() {
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
        fill(255, 128);
        text("Average Center Frequency: " + fft.getAverageCenterFrequency(i), 5, 25);
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
    stroke(#FF0000);
    line(0, 0, fftWidth, 0);

    popMatrix();

    
  }

  void controlEvent(ControlEvent theEvent) {
    switch(theEvent.getController().getName()) {
      case "expBase":
        expBase = theEvent.getController().getValue();
        break;
      case "signalScale":
        signalScale = theEvent.getController().getValue();
        break;
      case "currentViz":
        int selectedIndex = (int)theEvent.getController().getValue();
        selected = selectedIndex;
        // TODO: set all controllers to viz defaults
        break;
    }
  }
}







