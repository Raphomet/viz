// Template for vizualizing zones in log-averaged FFT
// Based on examples: http://code.compartmental.net/minim/fft_method_logaverages.html
//                and http://www.openprocessing.org/sketch/101123

import ddf.minim.analysis.*;
import ddf.minim.*;

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
float expBase         = 1.75; // exponent base for "amplifying" band values // 1.75 works well for logAverages
int constraintCeiling = 100;
WindowFunction window = FFT.HAMMING;


// signal
float signalScale = 4;

// visualization-dependent variables 
float visualScale = 4;

void setup() {
  size(640, 640);

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

  rectMode(CORNERS);
  noStroke();
  textSize( 18 );
}

void draw() {
  background(0);

  float[] signals = getAdjustedFftSignals();

  for (int i = 0; i < signals.length; i++) {
    float boxWidth = width / signals.length;
    
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
    rect(xl, height, xr, height - signals[i] * visualScale);

    // draw constraint
    strokeWeight(1);
    stroke(#FF0000);
    line(0, height - constraintCeiling * visualScale, width, height - constraintCeiling * visualScale);
  }
}

// Boost FFT signals in each band, constrain them to a ceiling.
// Return adjusted results in array.
float[] getAdjustedFftSignals() {
  float[] signals = new float[fft.avgSize()];

  fft.forward(in.mix);
  for(int i = 0; i < fft.avgSize(); i++) {
    // adjust and constrain signal value
    float adjustedAvg    = fft.getAvg(i) * pow(expBase, i) * signalScale;
    float constrainedAvg = constrain(adjustedAvg, 0, constraintCeiling);

    signals[i] = constrainedAvg;
  }

  println(signals);

  return signals;
}




