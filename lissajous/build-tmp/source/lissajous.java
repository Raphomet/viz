import processing.core.*; 
import processing.data.*; 
import processing.event.*; 
import processing.opengl.*; 

import ddf.minim.analysis.*; 
import ddf.minim.*; 
import controlP5.*; 
import java.util.LinkedList; 

import java.util.HashMap; 
import java.util.ArrayList; 
import java.io.File; 
import java.io.BufferedReader; 
import java.io.PrintWriter; 
import java.io.InputStream; 
import java.io.OutputStream; 
import java.io.IOException; 

public class lissajous extends PApplet {






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
float expBase         = 1.75f; // exponent base for "amplifying" band values // 1.75 works well for logAverages
int constraintCeiling = 100;
WindowFunction window = FFT.HAMMING;

// signal
float signalScale = 3;
float[] signals; // global?

// visualization-dependent variables
int   background = 0xffFFFFFF;

int matrixWidth = 30;
int matrixHeight = 6;

LinkedList dotMatrix = new LinkedList();

ControlFrame cf;
int cfWidth = 1000;
int cfHeight = 600;


public void settings() {
  size(640, 640);
}

public void setup() {

  minim = new Minim(this);

  // if using line in
  in = minim.getLineIn(Minim.STEREO, 512);

  // if using file
  // in = minim.loadFile(filePath, bufferSize);
  // in.play(startPosition);
    
  fft = new FFT(in.bufferSize(), in.sampleRate());
  fft.logAverages(fftBaseFrequency, fftBandsPerOctave);

  if (window != null) {
    fft.window(window);
  }
  

  // viz setup

}

int a = 0;
ArrayList<PVector> points = new ArrayList<PVector>();

public void draw() {
  background(background);

  // signals = getAdjustedFftSignals();

  translate(width/2, height/2);

  int speed = 2;
  float x = sin(radians(frameCount * speed))*cos(radians(frameCount * 4 * speed))*width/3;
  float y = cos(radians(frameCount * speed))*width/3;  

  points.add(new PVector(x, y));
  if (points.size() > 100) {
    points.remove(0);
  }

  points.add(new PVector(-x, y));
  if (points.size() > 10) {
    points.remove(0);
  }

  noStroke();
  beginShape(TRIANGLE_STRIP);
  for (int i = 0; i < points.size(); i++) {
    PVector point = points.get(i);

    // ellipse(point.x, point.y, 5, 5);
    // fill(10);
    fill(0, 0, 0, map((float)i / points.size(), 0, 1, 0, 255));
    vertex(point.x, point.y);
  }
  endShape();
}

// Boost FFT signals in each band, constrain them to a ceiling.
// Return adjusted results in array.
public float[] getAdjustedFftSignals() {
  float[] signals = new float[fft.avgSize()];

  fft.forward(in.mix);
  for(int i = 0; i < fft.avgSize(); i++) {
    // adjust and constrain signal value
    float adjustedAvg    = fft.getAvg(i) * pow(expBase, i) * signalScale;
    float constrainedAvg = constrain(adjustedAvg, 0, constraintCeiling);

    signals[i] = constrainedAvg;
  }

  return signals;
}




class ControlFrame extends PApplet {

  int w, h;
  PApplet parent;
  ControlP5 cp5;

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
    surface.setLocation(10, 10);
    cp5 = new ControlP5(this);

    // cp5.addNumberbox("numLines")
    //    .plugTo(parent, "numLines")
    //    .setRange(minLines, maxLines)
    //    .setValue(15)
    //    .setPosition(100, 10)
    //    .setSize(100, 20);
  }

  public void draw() {
    background(0);    
  }
}
  static public void main(String[] passedArgs) {
    String[] appletArgs = new String[] { "lissajous" };
    if (passedArgs != null) {
      PApplet.main(concat(appletArgs, passedArgs));
    } else {
      PApplet.main(appletArgs);
    }
  }
}
