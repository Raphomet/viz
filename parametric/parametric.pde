// Try: Fast Eddie - Hip House

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

float expBase         = 1.75; // exponent base for "amplifying" band values
int constraintCeiling = 80;
WindowFunction window = FFT.HAMMING;

float scale = 250;

// void settings() {
//   // fullScreen();
// }

void setup() {
  // surface.setSize(640,640);
  size(640, 640);

  minim = new Minim(this);

  // if using line in
  in = minim.getLineIn(Minim.STEREO, 512);

  // if using file
  // in = minim.loadFile(filePath, bufferSize);
  // in.play(startPosition);
    
  fft = new FFT(in.bufferSize(), in.sampleRate());
  fft.logAverages(fftBaseFrequency, fftBandsPerOctave);

  if(window != null) {
    fft.window(FFT.HAMMING);
  }

  colorMode(HSB, 256);

  background(0);
}

void draw() {

  translate(width / 2, height / 2);

  // Draw shapes
  // noStroke();
  // fill(0, 256, 256);
  // ellipse(x1(frameCount), y1(frameCount), 5, 5);
  // fill(128, 256, 256);
  // ellipse(x2(frameCount), y2(frameCount), 5, 5);

  // Draw lines
  int lines = 10;

  background(0);

  float[] signals = getAdjustedFftSignals();

  for(int i = 0; i < (int) map(signals[0], 0, constraintCeiling / 2, 0, 50); i++) {
    // strokeWeight(5);

    strokeWeight(pow(map(signals[5], 0, constraintCeiling, 0, 7), 2));
    strokeCap(SQUARE);

    stroke((frameCount + i) % 256, 256, 256, map(signals[5], 0, constraintCeiling, 100, 255));
    line(x1(frameCount + i), y1(frameCount + i), x2(frameCount + i), y2(frameCount + i));
  }
}

float x1(float t) {
  return cos(t / 13) * scale + sin(t / 80) * 30;
}

float y1(float t) {
  return sin(t / 10) * scale;
}

float x2(float t) {
  return cos(t / 5) * scale + cos(t / 7) * 2;
}

float y2(float t) {
  return sin(t / 20) * scale + cos(t / 9) * 30;
}


// void drawRose() {
//   pushMatrix();
//   translate(width / 2, height / 2);

//   for(float t = 0; t < TWO_PI * 10; t += (TWO_PI / 1000)) {

//     float scale = 200;

//     float p = 19;
//     float q = (float)ceil(mouseX / (width / 10));
//     float k = p / q;

//     float x = (cos(k * t) * cos(t)) * scale;
//     float y = (cos(k * t) * sin(t)) * scale;

//     noStroke();
//     fill(100);
//     ellipse(x, y, 5, 5);
//   }

//   popMatrix();
// }



// Boost FFT signals in each band, constrain them to a ceiling.
// Return adjusted results in array.
float[] getAdjustedFftSignals() {
  float[] signals = new float[fft.avgSize()];

  fft.forward(in.mix);
  for(int i = 0; i < fft.avgSize(); i++) {
    // adjust and constrain signal value
    float adjustedAvg    = fft.getAvg(i) * pow(expBase, i);
    float constrainedAvg = constrain(adjustedAvg, 0, constraintCeiling);

    signals[i] = constrainedAvg;
  }

  return signals;
}




