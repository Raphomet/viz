import processing.core.*; 
import processing.data.*; 
import processing.event.*; 
import processing.opengl.*; 

import ddf.minim.analysis.*; 
import ddf.minim.*; 

import java.util.HashMap; 
import java.util.ArrayList; 
import java.io.File; 
import java.io.BufferedReader; 
import java.io.PrintWriter; 
import java.io.InputStream; 
import java.io.OutputStream; 
import java.io.IOException; 

public class jagged_lines extends PApplet {

// Turn on Billie




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

// visualization-dependent variables
int   background = 0xffDCD6B2;
int[] palette = new int[] { 0xff4E7989, 0xffA9011B, 0xff80944E }; // colorlisa - picasso - the dream

int numLines = 15;
int[] lineColorIndex;

int lineSpacing = 20;
float segmentLength = 40;

float minLineThickness = 1;
float maxLineThickness = 10;

float lineWidth; // determined by stage width

public void setup() {
  

  minim = new Minim(this);

  // if using line in
  in = minim.getLineIn(Minim.STEREO, 512);

  // if using file
  // in = minim.loadFile(filePath, bufferSize);
  // in.play(startPosition);
    
  fft = new FFT(in.bufferSize(), in.sampleRate());
  fft.logAverages(fftBaseFrequency, fftBandsPerOctave);

  if(window != null) {
    fft.window(window);
  }
  
  lineColorIndex = new int[numLines];

  for (int i = 0; i < numLines; i++) {
    lineColorIndex[i] = (int)random(palette.length);
  }

  lineWidth = width * 1.5f;
}

public void draw() {
  background(background);

  float[] signals = getAdjustedFftSignals();

  noFill();

  int segments = (int)(lineWidth / segmentLength);

  // translate(0, (height / 2) - (lineSpacing * numLines / 2));

  translate(width / 2, height / 2);
  rotate((float)frameCount / 300);

  for (int l = 0; l < numLines; l++) {

    float lineY = l * lineSpacing - (numLines * lineSpacing ) / 2;
    stroke(palette[lineColorIndex[l]]);

    // strokeWeight(4);
    // float yoff = sin((float)frameCount / 20) * segmentLength / 2;
    // float yoff = sin(frameCount / 10.0 + l * 0.1) * segmentLength / 2;
    // float yoff = sin(frameCount / 10.0) * segmentLength / 2; yoff *= (1 + 0.2 * l);

    float yoff = map(signals[5], 0, 100, 0, segmentLength * 1.5f);
    strokeWeight(map(signals[0], 0, 100, minLineThickness, maxLineThickness));

    beginShape();
    for (int i = 0; i <= segments; i++) {
      if (i % 2 == 0) {
        vertex(i * segmentLength - (lineWidth / 2), lineY + yoff);
      }
      else {
        vertex(i * segmentLength - (lineWidth / 2), lineY - yoff); 
      }
    }
    endShape();
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

  println(signals);

  return signals;
}








  public void settings() {  size(640, 640); }
  static public void main(String[] passedArgs) {
    String[] appletArgs = new String[] { "jagged_lines" };
    if (passedArgs != null) {
      PApplet.main(concat(appletArgs, passedArgs));
    } else {
      PApplet.main(appletArgs);
    }
  }
}
