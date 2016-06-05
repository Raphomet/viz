import ddf.minim.analysis.*;
import ddf.minim.*;
import controlP5.*;
import java.util.*;
import themidibus.*;

Minim minim;
FFT fft;
MidiBus kontrol;
int kontrolChannel = 0; // this may change?

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
int cfWidth = 1200;
int cfHeight = 600;

float[] signals;

ArrayList<VizBase> apps;
int selected;

void setup() {
  size(640, 640);
  surface.setSize(640, 640);
  surface.setLocation(100, 100);

  // set up korg nanokontrol2
  kontrol = new MidiBus(this, kontrolChannel, -1);

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
  apps.add(new Hexagons(this));
  apps.add(new TwinkleToph(this));
  apps.add(new Planets(this));
  apps.add(new Jags(this));
  apps.add(new DotMatrix(this));

  List<String> appNames = new ArrayList<String>();
  for (VizBase app : apps) {
    appNames.add(app.getName());
  }

  // set up control panel
  cf = new ControlFrame(this, cfWidth, cfHeight, "Controls", defaultExpBase, defaultSignalScale, appNames);

  //calling the initialization function on each
  //Applet in the list.
  for(VizBase a : apps) {
    a.setControlFrame(cf);
    a.init();
  }
  
  selected = 0;
}

void draw() {
  signals = getAdjustedFftSignals();
  cf.setSignals(signals);

  apps.get(selected).display(signals);
}

void sendExpBase(int value) {
  float normalizedExpBase = map(value, 0, 127, 0, 3.0);

  cf.setExpBase(normalizedExpBase);
  setExpBase(normalizedExpBase);
}

void setExpBase(float _expBase) {
  expBase = _expBase;
}

void sendSignalScale(int value) {
  float normalizedSignalScale = map(value, 0, 127, 0.5, 8);

  cf.setSignalScale(normalizedSignalScale);
  setSignalScale(normalizedSignalScale);
}

void setSignalScale(float _signalScale) {
  signalScale = _signalScale;
}

void setSelected(int _selected) {
  selected = _selected;
  cf.initializeAppControls(getCurrentSketch());
}

// TODO: rename apps to sketches
VizBase getCurrentSketch() {
  return apps.get(selected);
}



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




void controllerChange(int channel, int number, int value) {

  float newValue;

  if (channel == kontrolChannel) {
    switch (number) {
      // sliders
      case 0: // leftmost slider
        sendExpBase(value);
        break;
      case 1: // second slider from left
        getCurrentSketch().setSpeed(value);
        cf.setSpeed(value);
        break;
      case 2: // third slider from left
        newValue = getCurrentSketch().setSize0((float)value, false);
        cf.setSize0(newValue);
        break;
      case 3: // fourth slider from left
        newValue = getCurrentSketch().setColorPalette((float)value, false);
        cf.setColorPalette(newValue);
        break;
      case 4: // fifth slider from left
        newValue = getCurrentSketch().setMode((float)value, false);
        cf.setMode(newValue);
        break;
      case 5: // third-rightmost slider
        // apps.get(selected).setX0(value, false);
        break;
      case 6: // second-rightmost slider
        // apps.get(selected).setY0(value, false);
        break;
      case 7: // rightmost slider
        // apps.get(selected).setZ0(value, false);
        break;

      // knobs
      case 16: // leftmost knob
        sendSignalScale(value);
        break;
      case 17: // second knob from left
        // apps.get(selected).setBpm(value, false);
        break;
      case 18: // third knob from left
        newValue = getCurrentSketch().setSize1((float)value, false);
        cf.setSize1(newValue);
        break;
      case 19: // fourth knob from left
        newValue = getCurrentSketch().setColorAdjustment((float)value, false);
        cf.setColorAdjustment(newValue);
        break;
      case 20: // fifth knob from left
        newValue = getCurrentSketch().setAlpha((float)value, false);
        cf.setAlpha(newValue);
        break;
      case 21: // third-rightmost knob
        // apps.get(selected).setX1(value, false);
        break;
      case 22: // second-rightmost knob
        // apps.get(selected).setY1(value, false);
        break;
      case 23: // rightmost knob
        // apps.get(selected).setZ1(value, false);
        break;

      // other buttons

      // "S": 32-39, ltr
      // "M": 48-55
      // "R": 64-71
      // rewind: 43
      // ff: 44
      // stop: 42
      // play: 41
      // record: 45
      // track back: 58
      // track fwd: 59
      // cycle: 46
      // set: 60
      // marker back: 61
      // marker fwd: 62
    }

    // update control panel
    // cf.controllerChange(channel, number, value);
  }
}



