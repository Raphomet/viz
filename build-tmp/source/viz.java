import processing.core.*; 
import processing.data.*; 
import processing.event.*; 
import processing.opengl.*; 

import ddf.minim.analysis.*; 
import ddf.minim.*; 
import controlP5.*; 
import java.util.*; 
import themidibus.*; 
import processing.core.*; 
import processing.core.*; 
import processing.core.*; 
import processing.core.*; 
import processing.core.*; 
import java.util.*; 
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

public void draw() {
  signals = getAdjustedFftSignals();
  cf.setSignals(signals);

  apps.get(selected).display(signals);
}

public void sendExpBase(int value) {
  float normalizedExpBase = map(value, 0, 127, 0, 3.0f);

  cf.setExpBase(normalizedExpBase);
  setExpBase(normalizedExpBase);
}

public void setExpBase(float _expBase) {
  expBase = _expBase;
}

public void sendSignalScale(int value) {
  float normalizedSignalScale = map(value, 0, 127, 0.5f, 8);

  cf.setSignalScale(normalizedSignalScale);
  setSignalScale(normalizedSignalScale);
}

public void setSignalScale(float _signalScale) {
  signalScale = _signalScale;
}

public void setSelected(int _selected) {
  selected = _selected;
  cf.initializeAppControls(getCurrentSketch());
}

// TODO: rename apps to sketches
public VizBase getCurrentSketch() {
  return apps.get(selected);
}



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




public void controllerChange(int channel, int number, int value) {
  if (channel == kontrolChannel) {
    switch (number) {
      // sliders
      case 0: // leftmost slider
        sendExpBase(value);
        break;
      case 1: // second slider from left
        // apps.get(selected).setBpm(value, false);
        break;
      case 2: // third slider from left
        // apps.get(selected).setSize0(value, false);
        break;
      case 3: // fourth slider from left
        // apps.get(selected).setColorPalette(value, false);
        break;
      case 4: // fifth slider from left
        // apps.get(selected).setMode(value, false);
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
        // apps.get(selected).setSpeed(value, false);
        break;
      case 18: // third knob from left
        // apps.get(selected).setSize1(value, false);
        break;
      case 19: // fourth knob from left
        // apps.get(selected).setColorAdjustment(value, false);
        break;
      case 20: // fifth knob from left
        float newValue = apps.get(selected).setAlpha(value, false);
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






public class Hexagons extends VizBase
{  
  Gon[][] gons;

  public Hexagons(PApplet parentApplet) {
    super(parentApplet);
    name = "Hexagons";
  }
  
  @Override
  public void init() {
    background(0);

    gons = new Gon[5][5];

    for (int i = 0; i < 5; i++) {
      for (int j = 0; i < 5; i++) {
        gons[i][j] = new Gon();
      }
    }

  }

  public @Override
  void display(float[] signals) {
    float x = 0;
    float y = 0;

    for (int i = 0; i < 5; i++) {
      for (int j = 0; j < 5; j++) {
        Gon gon = gons[i][j];

        float y2 = y;
        if (x % 2 == 1) {
          y2 += 50;
        }
        gon.display(x, y2, 40);
        println(i + " " + j + " " + x + " " + y2);

        y += 100;
      }
      x += 100;
    }

  }

  class Gon {

    int myColor;

    public Gon() {
      myColor = 0xffff0000;
    }

    // some shit
    public void display(float centerX, float centerY, float radius) {
      float angle = TWO_PI / 6;
      beginShape();
      for (float a = 0; a < TWO_PI; a += angle) {
        float sx = centerX + cos(a) * radius;
        float sy = centerY + sin(a) * radius;
        vertex(sx, sy);
      }
      endShape(CLOSE);
    }

  }
}



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
// modes:
// points/circles, not lines?
// triangle strip!?



public class ParametricLines extends VizBase
{
  // private PVector p;
  private float scale = 250; // TODO: make relative to size of canvas?

  private int size0Signal = 0; // basically, the number of objects on screen
  
  public ParametricLines(PApplet parentApplet) {
    super(parentApplet);
    name = "Parametric Lines";

    // initialize controls
    usesAlpha = true;
    minAlpha = 0;
    defaultAlpha = 100;
    maxAlpha = 255;
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

    for(int i = 0; i < (int) map(signals[size0Signal], 0, 100 / 2, 0, 50); i++) {
      // strokeWeight(5);

      strokeWeight(pow(map(signals[5], 0, 100, 0, 7), 2));
      strokeCap(SQUARE);

      stroke((frameCount + i) % 256, 256, 256, map(signals[alphaSignal], 0, 100, minAlpha, 255));
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

  @Override
  public float setAlpha(float value, boolean normalized) {
    minAlpha = normalized ? value : map(value, 0, 127, 0, 255);
    return minAlpha;
  }

  @Override
  public void setAlphaSignal(int value) {
    alphaSignal = value;
  }


}

/**
 * - must actually make this respond to music...
 *
 * Ideas:
 * - finish more planet types
 * - draw orbit trails, alpha it in
 * - orbit size pulses with music
 * - starfield background
 * - color planets
 * - prettify sun
 */




public class Planets extends VizBase
{  
  public Planets(PApplet parentApplet) {
    super(parentApplet);
    name = "Planets";
  }
  

  List<Planet> planets = new ArrayList<Planet>();

  @Override
  public void init() {
    // setup

    // create planets here
    for (int i = 0; i < 30; i++) {
      planets.add(new Planet());
    }
  }

  public @Override
  void display(float[] signals) {
    background(0);

    // draw a sun
    translate(width / 2, height / 2);
    ellipseMode(RADIUS);
    noFill();
    strokeWeight(8);
    stroke(255);
    ellipse(0, 0, 10, 10);

    // draw planets
    for (int i = 0; i < planets.size(); i++) {
      planets.get(i).display(frameCount / 100.0f, (i + 1) * 10);
    }
  }

  // a planet has:
  //   - a, radius on x axis (normalized)
  //   - b, radius on y axis (normalized)
  //   - radius multiplier
  //   - rotational tilt
  //   - multiple draw modes
  //
  //   - color?
  //   - afterimage?
  //   - trail?
  class Planet {

    float a;
    float b;

    float rot;

    boolean clockwise;

    static final int TYPE_SIMPLE = 0;
    static final int TYPE_SIMPLE_WITH_MOON = 1;
    static final int TYPE_SIMPLE_WITH_TWO_MOONS = 2;
    static final int TYPE_SIMPLE_WITH_MOON_WITH_MOON = 3;
    static final int TYPE_SIMPLE_WITH_RING = 4;
    static final int TYPE_BINARY = 5;
    static final int TYPE_TRINARY = 6;
    int type;
    float radius;

    Moon moon;
    Moon moon2;

    public Planet() {

      a = random(1.2f) + 0.25f;
      b = random(1.2f) + 0.25f;
      radius = random(10) + 8;
      rot = random(1) * TWO_PI;

      clockwise = new Random().nextBoolean();

      type = (int)random(2);
      type = TYPE_SIMPLE_WITH_MOON;

      if (type == TYPE_SIMPLE_WITH_MOON) {
        moon = new Moon(false);
      }
    }

    // 
    public void display(float t, float distance) {

      pushMatrix();
      rotate(rot);
      ellipseMode(RADIUS);

      switch (type) {
        case TYPE_SIMPLE_WITH_MOON:
          fill(255);
          noStroke();
          float x = x(t) * distance;
          float y = y(t) * distance;
          ellipse(x, y, radius, radius);
          moon.display(t, x, y, radius);
          break;
        default: // TYPE_SIMPLE
          fill(255);
          noStroke();
          ellipse(x(t) * distance, y(t) * distance, radius, radius);
          break;
      }

      popMatrix();
    }

    private float x(float t) {
      int direction = clockwise ? 1 : -1;
      return a * cos(t) * direction;
    }

    private float y(float t) {
      return b * sin(t);
    }

    class Moon {
      float a;
      float b;

      float radius;
      boolean clockwise;

      Moon moon;

      public Moon(boolean hasMoon) {
        a = random(1.2f) + 0.25f;
        b = random(1.2f) + 0.25f;

        radius = random(4) + 2;

        clockwise = new Random().nextBoolean();

        if (hasMoon) {
          moon = new Moon(false);
        }
      }

      public void display(float t, float centerX, float centerY, float bodyRadius) {
        // TODO: draw moon that orbits around centerX and centerY

        // fill(255, 0, 0);
        noFill();
        strokeWeight(2);
        stroke(128, 128, 128);
        ellipse(x(t) * (bodyRadius + 20) + centerX, y(t) * (bodyRadius + 20) + centerY, radius, radius);

        if (moon != null) {
          // TODO: draw submoon
        }
      }

      private float x(float t) {
        int direction = clockwise ? 1 : -1;
        return a * cos(t) * direction;
      }

      private float y(float t) {
        return b * sin(t);
      }

    }


  }



}



/*
 * - don't squish the image
 * - switch between images
 * - use different shape masks
 * - use different color schemes
 */

public class TwinkleToph extends VizBase
{  

  PImage img;

  public TwinkleToph(PApplet parentApplet) {
    super(parentApplet);
    name = "Twinkle Toph";
  }
  
  @Override
  public void init() {
    img = loadImage("toph.jpg");
  }

  public @Override
  void display(float[] signals) {
    if (frameCount % 10 != 0) {
      return;
    }

    background(255);
    for (int gridX = 0; gridX < img.width; gridX++) {
      for (int gridY = 0; gridY < img.height; gridY++) {
        float tileWidth = width / (float) img.width;
        float tileHeight = height / (float) img.height;
        float posX = tileWidth * gridX;
        float posY = tileHeight * gridY;
        
        int c = img.pixels[gridY * img.width + gridX];
        int greyscale = round(red(c) * 0.222f + green(c) * 0.707f + blue(c) * 0.071f);
        
        float w = map(greyscale, 0, 255, 10, 0);
        noStroke();
        fill(c);
        
        float sizeAdjust = random(1);
        
        ellipse(posX, posY, w * sizeAdjust, w * sizeAdjust);
      }
    }
  }
}

  public void settings() {  size(640, 640); }
  static public void main(String[] passedArgs) {
    String[] appletArgs = new String[] { "viz" };
    if (passedArgs != null) {
      PApplet.main(concat(appletArgs, passedArgs));
    } else {
      PApplet.main(appletArgs);
    }
  }
}
