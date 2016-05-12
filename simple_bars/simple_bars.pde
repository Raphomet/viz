// Template for vizualizing zones in log-averaged FFT
// Based on examples: http://code.compartmental.net/minim/fft_method_logaverages.html
//                and http://www.openprocessing.org/sketch/101123

import ddf.minim.analysis.*;
import ddf.minim.*;

Minim minim;  
AudioPlayer file;
FFT fft;

// FFT parameters
int bufferSize = 512;
int fftBaseFrequency = 86;
int fftBandsPerOctave = 1;

// song-dependent variables
String filePath       = "/Users/raph/Music/iTunes/iTunes Music/Simian Mobile Disco/Bugged Out_ Suck My Deck/01 Joakim - Drumtrax.mp3";
int startPosition     = 30000; // milliseconds
float expBase         = 1.75; // exponent base for "amplifying" band values
int constraintCeiling = 100;
WindowFunction window = FFT.HAMMING;

// visualization-dependent variables
float spectrumScale = 2;

void setup() {
  size(512, 240);

  minim = new Minim(this);
  file = minim.loadFile(filePath, bufferSize);
  file.play(startPosition);
  
  fft = new FFT( file.bufferSize(), file.sampleRate() );
  fft.logAverages(fftBaseFrequency, fftBandsPerOctave);

  if(window != null) {
    fft.window(FFT.HAMMING);
  }
  
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
      text("Logarithmic Average Center Frequency: " + fft.getAverageCenterFrequency(i), 5, 25);
      fill(255, 0, 0);
    }
    else {
      fill(255);
    }

    // draw a rectangle for each signal value
    noStroke();
    rect(xl, height, xr, height - signals[i] * spectrumScale);

    // draw constraint
    strokeWeight(1);
    stroke(#FF0000);
    line(0, height - constraintCeiling * spectrumScale, width, height - constraintCeiling * spectrumScale);
  }
}

// Boost FFT signals in each band, constrain them to a ceiling.
// Return adjusted results in array.
float[] getAdjustedFftSignals() {
  float[] signals = new float[fft.avgSize()];

  fft.forward( file.mix );
  for(int i = 0; i < fft.avgSize(); i++) {
    // adjust and constrain signal value
    float adjustedAvg    = fft.getAvg(i) * pow(expBase, i);
    float constrainedAvg = constrain(adjustedAvg, 0, constraintCeiling);

    signals[i] = constrainedAvg;
  }

  return signals;
}




