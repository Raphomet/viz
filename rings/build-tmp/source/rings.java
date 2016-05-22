import processing.core.*; 
import processing.data.*; 
import processing.event.*; 
import processing.opengl.*; 

import ddf.minim.analysis.*; 
import ddf.minim.*; 
import java.util.LinkedList; 

import java.util.HashMap; 
import java.util.ArrayList; 
import java.io.File; 
import java.io.BufferedReader; 
import java.io.PrintWriter; 
import java.io.InputStream; 
import java.io.OutputStream; 
import java.io.IOException; 

public class rings extends PApplet {

// Template for vizualizing zones in log-averaged FFT
// Based on examples: http://code.compartmental.net/minim/fft_method_logaverages.html
//                and http://www.openprocessing.org/sketch/101123





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
float signalScale = 4;

// visualization-dependent variables
float visualScale = 4;
int numRings = 100;
LinkedList lineWidths = new LinkedList();

public void setup() {
  

  /*
   * Set up sound processing
   */ 

  minim = new Minim(this);

  // if using line in
  in = minim.getLineIn(Minim.STEREO, 512);

  // if using file
  // in = minim.loadFile(filePath, bufferSize);
  // in.play(startPosition);
    
  fft = new FFT(in.bufferSize(), in.sampleRate());
  fft.logAverages(fftBaseFrequency, fftBandsPerOctave);
  // fft.linAverages(30);

  if(window != null) {
    fft.window(window);
  }
  
  /*
   * Set up viz
   */ 

  // rectMode(CORNERS);
  for (int i = 0; i < numRings; i++) {
    lineWidths.offer(0);
  }
}


public void draw() {
  background(0);

  float[] signals = getAdjustedFftSignals();

  translate(width / 2, height / 2);

  lineWidths.offer((float)(signals[0] / 10.0f));
  lineWidths.poll();

  for (int i = 0; i < numRings; i++) {
    strokeWeight((int)lineWidths.get(i)); // TODO: respond to bass?
    noFill();
    stroke(255);

    float diameter = i * 10;
    ellipse(-diameter / 4, -diameter / 4, diameter, diameter);
  }
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




  public void settings() {  size(640, 640); }
  static public void main(String[] passedArgs) {
    String[] appletArgs = new String[] { "rings" };
    if (passedArgs != null) {
      PApplet.main(concat(appletArgs, passedArgs));
    } else {
      PApplet.main(appletArgs);
    }
  }
}
