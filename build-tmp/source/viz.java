import processing.core.*; 
import processing.data.*; 
import processing.event.*; 
import processing.opengl.*; 

import ddf.minim.analysis.*; 
import ddf.minim.*; 
import controlP5.*; 
import java.util.*; 
import processing.core.*; 
import processing.core.*; 
import processing.core.*; 

import java.util.HashMap; 
import java.util.ArrayList; 
import java.io.File; 
import java.io.BufferedReader; 
import java.io.PrintWriter; 
import java.io.InputStream; 
import java.io.OutputStream; 
import java.io.IOException; 

public class viz extends PApplet {






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

float defaultExpBase         = 1.75f; // exponent base for "amplifying" band values
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

public void setup() {
  
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

public void draw() {
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
public float[] getAdjustedFftSignals() {
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
      .setRange(0.5f, 8)
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
    stroke(0xffFF0000);
    line(0, 0, fftWidth, 0);

    popMatrix();

    
  }

  public void controlEvent(ControlEvent theEvent) {
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









public class DotMatrix extends VizBase {
  // visualization-dependent variables
  int   background = 0xffFFFFFF;

  int matrixWidth = 30;
  int matrixHeight = 6;

  LinkedList dotMatrix = new LinkedList();

  public DotMatrix(PApplet parentApplet) {
    super(parentApplet);
    name = "Dot Matrix";
  }

  @Override
  public void init() {

    for (int i = 0; i < matrixWidth * matrixHeight; i++) {
      dotMatrix.offer(new CellDotData(0, null));
    }
    // cf = new ControlFrame(this, cfWidth, cfHeight, "Controls");

    // TODO: find some other way to slow down the animation speed
    // frameRate(10);
  }

  public void keyPressed() {
    if (key == ' ') {
      dotMatrix.clear();
      for (int i = 0; i < matrixWidth * matrixHeight; i++) {
        dotMatrix.offer(new CellDotData(0, null));
      }
    }
  }

  public @Override
  void display(float[] signals) {
    background(background);

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

  // POJO
  class CellDotData {
    int numDots;
    byte[] colorings;

    public CellDotData(int _numDots, byte[] _colorings) {
      numDots = _numDots;
      colorings = _colorings;
    }
  }


}



// import processing.core.*;


// // todo: this used linaverages!
// public class Flyover extends VizBase {
//   int rows = 30;
//   int cols = bands;

//   int w = 1200;
//   int h = 1200;

//   float zBoost = 2;

//   // queue (y) of arrays of size cols, containing z-height info
//   LinkedList terrain = new LinkedList();

//   float flying = 0;

//   public Flyover(PApplet parentApplet) {
//     super(parentApplet);
//     name = "Flyover";
//   }

//   @Override
//   public void init() {
//     colorMode(HSB, 256);
//     background(0);
//   }

//   @Override
//   void display(float[] signals) {
//     translate(width / 2, height / 2);

//     // Draw lines
//     int lines = 10;

//     background(0);

//     for(int i = 0; i < (int) map(signals[0], 0, 100 / 2, 0, 50); i++) {
//       // strokeWeight(5);

//       strokeWeight(pow(map(signals[5], 0, 100, 0, 7), 2));
//       strokeCap(SQUARE);

//       stroke((frameCount + i) % 256, 256, 256, map(signals[5], 0, 100, 100, 255));
//       line(x1(frameCount + i), y1(frameCount + i), x2(frameCount + i), y2(frameCount + i));
//     }
//   }
// }




// visualization-dependent variables


// void setup() {
//   size(640, 640, P3D);

//   minim = new Minim(this);

//   // if using line in
//   // in = minim.getLineIn(Minim.STEREO, 512);

//   // if using file
//   in = minim.loadFile(filePath, bufferSize);
//   in.play(startPosition);
    
//   fft = new FFT(in.bufferSize(), in.sampleRate());
//   fft.linAverages(bands);

//   if(window != null) {
//     fft.window(window);
//   }


// }

// void draw() {
//   background(0);

//   float[] signals = getAdjustedFftSignals();

//   translate(width / 2, height / 2);
//   rotateX(PI / 3);

//   translate(-w / 2, -h / 2);

//   // calculate z
//   // flying -= 0.1;
//   // float yoff = flying;
//   // for (int y = 0; y < rows; y++) {
//   //   float xoff = 0;
//   //   for (int x = 0; x < cols; x++) {
//   //     z[x][y] = map(noise(xoff, yoff), 0, 1, -100, 100);

//   //     xoff += 0.2;
//   //   }

//   //   yoff += 0.2;
//   // }

//   // push new fft signals onto tail of terrain
//   if (frameCount % 2 == 0) {
//     terrain.offer(signals);
//     terrain.poll();
//   }

//   // draw triangle strips
//   for (int y = 0; y < rows - 1; y++) {
//     beginShape(TRIANGLE_STRIP);
//     stroke(255);
//     noFill();

//     float[] terrainRow = (float[])terrain.get(terrain.size() - y - 1);
//     for (int x = 0; x < cols; x++) {
//       vertex(x * (w / cols), y * (h / rows), terrainRow[x] * zBoost);
//       vertex(x * (w / cols), (y + 1) * (h / rows), terrainRow[x] * zBoost);
//     }
//     endShape();
//   }
// }

// // Boost FFT signals in each band, constrain them to a ceiling.
// // Return adjusted results in array.
// float[] getAdjustedFftSignals() {
//   float[] signals = new float[fft.avgSize()];

//   fft.forward(in.mix);
//   for(int i = 0; i < fft.avgSize(); i++) {
//     // adjust and constrain signal value
//     float adjustedAvg    = fft.getAvg(i) * pow(expBase, i) * signalScale;
//     float constrainedAvg = constrain(adjustedAvg, 0, constraintCeiling);

//     signals[i] = constrainedAvg;
//   }

//   return signals;
// }






public class Jags extends VizBase {
  // visualization-dependent variables
  int   background = 0xffDCD6B2;
  int[] palette = new int[] { 0xff4E7989, 0xffA9011B, 0xff80944E }; // colorlisa - picasso - the dream

  int numLines = 15;
  int minLines = 1;
  int maxLines = 30;
  int[] lineColorIndex;

  int lineSpacing = 20;
  float segmentLength = 40;

  float minLineThickness = 1;
  float maxLineThickness = 10;

  float lineWidth; // determined by stage width


  public Jags(PApplet parentApplet) {
    super(parentApplet);
    name = "Jags";
  }
  
  @Override
  public void init() {
    lineColorIndex = new int[maxLines];

    for (int i = 0; i < maxLines; i++) {
      lineColorIndex[i] = (int)random(palette.length);
    }

    lineWidth = width * 1.5f;
  }

  public @Override
  void display(float[] signals) {
    background(background);

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
}


public class ParametricLines extends VizBase
{
  // private PVector p;
  private float scale = 250; // TODO: make relative to size of canvas?
  
  public ParametricLines(PApplet parentApplet) {
    super(parentApplet);
    name = "Parametric Lines";
  }
  
  @Override
  public void init() {
    colorMode(HSB, 256);
    background(0);
  }

  public @Override
  void display(float[] signals) {
    translate(width / 2, height / 2);

    // Draw lines
    int lines = 10;

    background(0);

    for(int i = 0; i < (int) map(signals[0], 0, 100 / 2, 0, 50); i++) {
      // strokeWeight(5);

      strokeWeight(pow(map(signals[5], 0, 100, 0, 7), 2));
      strokeCap(SQUARE);

      stroke((frameCount + i) % 256, 256, 256, map(signals[5], 0, 100, 100, 255));
      line(x1(frameCount + i), y1(frameCount + i), x2(frameCount + i), y2(frameCount + i));
    }
  }

  public float x1(float t) {
    return cos(t / 13) * scale + sin(t / 80) * 30;
  }

  public float y1(float t) {
    return sin(t / 10) * scale;
  }

  public float x2(float t) {
    return cos(t / 5) * scale + cos(t / 7) * 2;
  }

  public float y2(float t) {
    return sin(t / 20) * scale + cos(t / 9) * 30;
  }
}

  static public void main(String[] passedArgs) {
    String[] appletArgs = new String[] { "viz" };
    if (passedArgs != null) {
      PApplet.main(concat(appletArgs, passedArgs));
    } else {
      PApplet.main(appletArgs);
    }
  }
}
