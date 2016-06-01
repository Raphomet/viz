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

public class dot_paragraphs extends PApplet {

// 






Minim minim;
FFT fft;

// line in vs. file
// AudioInput  in;
AudioPlayer in;

// FFT parameters
int bufferSize = 512;
int fftBaseFrequency = 86;
int fftBandsPerOctave = 1;

// song-dependent variables
String filePath       = "/Users/raph/Music/iTunes/iTunes Music/Blackalicious/Blazing Arrow/12 Chemical Calisthenics.mp3";
int startPosition     = 16000; // milliseconds
float expBase         = 1.75f; // exponent base for "amplifying" band values // 1.75 works well for logAverages
int constraintCeiling = 100;
WindowFunction window = FFT.HAMMING;

// signal
float signalScale = 3;
float visualScale = 1;

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
  fullScreen();
  size(640, 640);
}

public void setup() {
  surface.setSize(640, 640);

  minim = new Minim(this);

  // if using line in
  // in = minim.getLineIn(Minim.STEREO, 512);

  // if using file
  in = minim.loadFile(filePath, bufferSize);
  in.play(startPosition);
    
  fft = new FFT(in.bufferSize(), in.sampleRate());
  fft.logAverages(fftBaseFrequency, fftBandsPerOctave);

  if (window != null) {
    fft.window(window);
  }
  

  // viz setup
  for (int i = 0; i < matrixWidth * matrixHeight; i++) {
    dotMatrix.offer(new CellDotData(0, null));
  }

  // cf = new ControlFrame(this, cfWidth, cfHeight, "Controls");

  frameRate(10);
}

public void keyPressed() {
  if (key == ' ') {
    dotMatrix.clear();
    for (int i = 0; i < matrixWidth * matrixHeight; i++) {
      dotMatrix.offer(new CellDotData(0, null));
    }
  }
}

public void draw() {
  background(background);

  signals = getAdjustedFftSignals();

  // add new signal to matrix
  int numDots = round(map(signals[0], 0, 100, 1, 6));
  dotMatrix.poll();
  dotMatrix.offer(new CellDotData(numDots, null));

  // draw the matrix
  int padding = 100;
  float cellWidth = (width - (padding * 2)) / matrixWidth;
  float cellHeight = (height - (padding * 2)) / matrixHeight;

  for (int j = 0; j < matrixHeight; j++) {
    for (int i = 0; i < matrixWidth; i++) {

      pushMatrix();
      translate(padding + cellWidth * i + (cellWidth), padding + cellHeight * (j + 1));

      CellDotData dotData = (CellDotData)dotMatrix.get(j * matrixWidth + i);

      noStroke();
      for (int k = 0; k < dotData.numDots; k++) {
        if (k == 5) {
          fill(255, 0, 0);
        }
        else {
          fill(0);
        }

        ellipse(0, -8 * k, 5 ,5);
      }

      popMatrix();
    }
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


// POJO
class CellDotData {
  int numDots;
  byte[] colorings;

  public CellDotData(int _numDots, byte[] _colorings) {
    numDots = _numDots;
    colorings = _colorings;
  }
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

    println(signals);

    int fftWidth = 300;
    int fftHeight = 100;

    translate(0, 0);

    for (int i = 0; i < signals.length; i++) {
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

      // draw constraint
      strokeWeight(1);
      stroke(0xffFF0000);
      line(0, fftHeight - constraintCeiling * visualScale, fftWidth, fftHeight - constraintCeiling * visualScale);
    }
    
  }
}
  static public void main(String[] passedArgs) {
    String[] appletArgs = new String[] { "dot_paragraphs" };
    if (passedArgs != null) {
      PApplet.main(concat(appletArgs, passedArgs));
    } else {
      PApplet.main(appletArgs);
    }
  }
}
