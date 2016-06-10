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
import java.util.*; 
import processing.core.*; 
import processing.core.*; 
import processing.core.*; 
import processing.core.*; 
import processing.core.*; 
import processing.core.*; 
import java.util.*; 
import processing.core.*; 
import java.util.*; 
import processing.core.*; 
import processing.core.*; 
import geomerative.*; 
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
int cfWidth = 1200;
int cfHeight = 600;

float[] signals;

ArrayList<VizBase> apps;
int selected;

public void setup() {
  
  // surface.setSize(600, 600);
  surface.setLocation(100, 100);

  // fullScreen(2);

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
  // apps.add(new Text(this));

  // apps.add(new Arcs(this));
  // apps.add(new Rings(this));
  // apps.add(new ParametricLines(this));
  // apps.add(new Jags(this));

  // apps.add(new DotMatrix(this));
  apps.add(new TwinkleToph(this));
  // apps.add(new Planets(this));

  List<String> appNames = new ArrayList<String>();
  for (VizBase app : apps) {
    appNames.add(app.getName());
  }

  // set up control panel
  cf = new ControlFrame(this, cfWidth, cfHeight, "Controls", defaultExpBase, defaultSignalScale, appNames);

  //calling the initialization function on each
  //Applet in the list.
  for(VizBase a : apps) {
    a.setControlFrame(cf); // attach controlframe to each app
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

    signals[i]           = constrainedAvg;
  }

  return signals;
}




public void controllerChange(int channel, int number, int value) {

  float newValue;

  if (channel == kontrolChannel) {
    switch (number) {
      // sliders
      case 0: // leftmost slider
        sendExpBase(value);
        break;
      case 1: // second slider from left
        newValue = getCurrentSketch().setSpeed((float)value, false);
        cf.setSpeed(newValue);
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
        newValue = getCurrentSketch().setX0((float)value, false);
        cf.setX0(newValue);
        break;
      case 6: // second-rightmost slider
        newValue = getCurrentSketch().setY0((float)value, false);
        cf.setY0(newValue);
        break;
      case 7: // rightmost slider
        newValue = getCurrentSketch().setZ0((float)value, false);
        cf.setZ0(newValue);
        break;

      // knobs
      case 16: // leftmost knob
        sendSignalScale(value);
        break;
      case 17: // second knob from left
        newValue = getCurrentSketch().setSensitivity((float)value, false);
        cf.setSensitivity(newValue);
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
        newValue = getCurrentSketch().setX1((float)value, false);
        cf.setX1(newValue);
        break;
      case 22: // second-rightmost knob
        newValue = getCurrentSketch().setY1((float)value, false);
        cf.setY1(newValue);
        break;
      case 23: // rightmost knob
        newValue = getCurrentSketch().setZ1((float)value, false);
        cf.setZ1(newValue);
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






public class Arcs extends VizBase
{  
  public Arcs(PApplet parentApplet) {
    super(parentApplet);
    name = "Arcs";

    usesColorPalette = true;
    numColorPalettes = 3;

    usesColorAdjustment = true;
    minColorAdjustment = 0;
    maxColorAdjustment = 255;
    defaultColorAdjustment = 0;
    colorAdjustment = defaultColorAdjustment;

    // number of arcs
    usesSize0 = true;
    minSize0 = 1;
    maxSize0 = 40;
    defaultSize0 = 1;
    size0 = defaultSize0;

    // base line thickness
    usesSize1 = true;
    minSize1 = 0.1f;
    maxSize1 = 10;
    defaultSize1 = 4;
    size1 = defaultSize1;

    // sensitivity
    usesSensitivity = true;
    minSensitivity = 0;
    maxSensitivity = 1;
    defaultSensitivity = 0.5f;
    sensitivity = defaultSensitivity;

    usesMode = true;
    numModes = 1;

    // arc completion speed
    usesSpeed = true;
    minSpeed = 0.01f;
    maxSpeed = 2;
    defaultSpeed = 1;
    speed = defaultSpeed;

    // cell count
    usesX0 = true;
    minX0 = 1;
    maxX0 = 8;
    defaultX0 = 1;
    x0 = defaultX0;

    // delay between arcs
    usesX1 = true;
    minX1 = -500;
    maxX1 = 500;
    defaultX1 = 0;
    x1 = defaultX1;

    usesY0 = true;
    minY0 = 1;
    maxY0 = 100;
    defaultY0 = 50;
    y0 = defaultY0;

    usesY1 = true;
    minY1 = 0;
    maxY1 = 400;
    defaultY1 = 100;
    y1 = defaultY1;


    // delay between ArcSets along i
    usesZ0 = true;
    minZ0 = 0;
    maxZ0 = 1000;
    defaultZ0 = 100;
    z0 = defaultZ0;

    // delay between ArcSets along j
    usesZ1 = true;
    minZ1 = 0;
    maxZ1 = 1000;
    defaultZ1 = 100;
    z1 = defaultZ1;
  }
  

  List<List<ArcSet>> arcSetGrid;

  @Override
  public void init() {
    arcSetGrid = new ArrayList<List<ArcSet>>();

    for (int j = 0; j < maxX0; j++) {
      arcSetGrid.add(new ArrayList<ArcSet>());
      for (int i = 0; i < maxX0; i++) {
        arcSetGrid.get(j).add(new ArcSet(i, j));
      }
    }

    colorMode(HSB, 255);
  }

  public @Override
  void display(float[] signals) {

    background(0);
    pushMatrix();

    translate(width / 2 - (((int)x0 - 1) * y1) / 2, height / 2 - (((int)x0 - 1) * y1) / 2);

    for (int j = 0; j < (int)x0; j++) {
      float y = j * y1;
      for (int i = 0; i < (int)x0; i++) {
        float x = i * y1;

        pushMatrix();
        translate(x, y);
        ArcSet currentArcSet = arcSetGrid.get(i).get(j);
        currentArcSet.display(signals);

        popMatrix();
      }
    }


    popMatrix();
  }




  @Override
  public float setSize0(float value, boolean normalized) {
    size0 = normalized ? value : map(value, 0, 127, minSize0, maxSize0);
    println("size0 changed to " + size0);
    return size0;
  }

  @Override
  public float setSize1(float value, boolean normalized) {
    size1 = normalized ? value : map(value, 0, 127, minSize1, maxSize1);
    println("size1 changed to " + size0);
    return size1;
  }


  @Override
  public float setX0(float value, boolean normalized) {
    x0 = normalized ? value : map(value, 0, 127, minX0, maxX0);
    println("x0 changed to " + x0);
    return x0;
  }

  @Override
  public float setX1(float value, boolean normalized) {
    x1 = normalized ? value : map(value, 0, 127, minX1, maxX1);
    println("x1 changed to " + x1);
    return x1;
  }

  @Override
  public float setY0(float value, boolean normalized) {
    y0 = normalized ? value : map(value, 0, 127, minY0, maxY0);
    println("y0 changed to " + y0);
    return y0;
  }

  @Override
  public float setY1(float value, boolean normalized) {
    y1 = normalized ? value : map(value, 0, 127, minY1, maxY1);
    println("y1 changed to " + y1);
    return y1;
  }


  @Override
  public float setZ0(float value, boolean normalized) {
    z0 = normalized ? value : map(value, 0, 127, minZ0, maxZ0);
    println("z0 changed to " + z0);
    return z0;
  }

  @Override
  public float setZ1(float value, boolean normalized) {
    z1 = normalized ? value : map(value, 0, 127, minZ1, maxZ1);
    println("z1 changed to " + z1);
    return z1;
  }


  @Override
  public float setColorPalette(float value, boolean normalized) {
    colorPalette = normalized ? round(value) : round(map(value, 0, 127, 0, numColorPalettes - 1));
    println("color palette changed to " + colorPalette);
    return (float)colorPalette;
  }

  @Override
  public float setColorAdjustment(float value, boolean normalized) {
    colorAdjustment = normalized ? value : map(value, 0, 127, minColorAdjustment, maxColorAdjustment);
    println("color adjustment changed to " + colorAdjustment);
    return colorAdjustment;
  }


  @Override
  public float setMode(float value, boolean normalized) {
    mode = normalized ? round(value) : round(map(value, 0, 127, 0, numModes - 1));
    println("mode changed to " + mode);
    return (float)mode;
  }

  @Override
  public float setSpeed(float value, boolean normalized) {
    speed = normalized ? value : map(value, 0, 127, minSpeed, maxSpeed);
    println("speed changed to " + speed);
    return speed;
  }

  @Override
  public float setSensitivity(float value, boolean normalized) {
    sensitivity = normalized ? value : map(value, 0, 127, minSensitivity, maxSensitivity);
    println("sensitivity changed to " + sensitivity);
    return sensitivity;
  }



  class ArcSet {

    int i;
    int j;

    public ArcSet(int _i, int _j) {
      i = _i;
      j = _j;
    }

    public void display(float[] signals) {

      pushMatrix();
      rotate(3 * HALF_PI);

      if (colorPalette == 0) {
        stroke(255);
      }
      else if(colorPalette == 2) {
        stroke(colorAdjustment, 255, 255 * ((x0 - i) / x0));
      }

      // draw each arc
      for (int k = 0; k < size0; k++) {
        noFill();
        strokeWeight(size1 + signals[k % 9] * sensitivity / 5.0f);

        if (colorPalette == 1) {
          stroke(colorAdjustment, 255, 255 * ((size0 - k) / size0));
        }

        if ((int)((millis() * speed) + (x1 * k) + (z0 * i) + (z1 * j)) / 1000 % 2 == 0) {
          arc(0, 0, y0 * (k + 1), y0 * (k + 1), 0, TWO_PI * (((millis() * speed) + (x1 * k) + (z0 * i) + (z1 * j)) % 1000) / 1000.0f);
        }
        else {
          arc(0, 0, y0 * (k + 1), y0 * (k + 1), TWO_PI * (((millis() * speed) + (x1 * k) + (z0 * i) + (z1 * j)) % 1000) / 1000.0f, TWO_PI);
        }
      }

      popMatrix();
    }
  }



}



public class Diamonds extends VizBase
{  
  public Diamonds(PApplet parentApplet) {
    super(parentApplet);
    name = "Diamonds";
  }
  
  @Override
  public void init() {
  }

  public @Override
  void display(float[] signals) {

    background(0);
    rectMode(CENTER);
    noStroke();
    fill(255);

    translate(width / 2, height / 2);

    for (int ringCount = 0; ringCount < 30; ringCount++) {
      for (float i = 0; i < TWO_PI; i += TWO_PI / (20 * (ringCount + 1))) {
        // draw rectangles
        pushMatrix();
        rotate(i + millis() / 400.0f);
        rect(20 * (ringCount + 1), 0, 10, 3);
        popMatrix();
      }
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




// IDEAS
// - populate from center in spiral
// - hexagon splits into six triangles that can move independently?
// - spin canvas
// - zoom canvas



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
      for (int j = 0; j < 5; j++) {
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
      y = 0;
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
  // colors: must be 4, first one is always background
  // color[] palette = new color[] { #DCD6B2, #4E7989, #A9011B, #80944E };

  int[][] palettes = {
    { 0xffDCD6B2, 0xff4E7989, 0xffA9011B, 0xff80944E },  // colorlisa - picasso - the dream
    { 0xff3F6F76, 0xff69B7CE, 0xffC65840, 0xffF4CE4B },  // colorlisa - chagall
    { 0xffFFFFFF, 0xffFF0061, 0xffE80058, 0xffCE004E },  // colorfriends - sexual addiction
  };

  int[] lineColorIndex;

  int lineSpacing = 20;
  float segmentLength = 40;

  float lineWidth; // determined by stage width


  public Jags(PApplet parentApplet) {
    super(parentApplet);
    name = "Jags";

    // controls

    // size0 = number of lines
    usesSize0 = true;
    minSize0 = 1;
    maxSize0 = 60;
    defaultSize0 = 10;
    size0 = defaultSize0;

    // size1 = max linethickness
    usesSize1 = true;
    minSize1 = 1;
    maxSize1 = 60;
    defaultSize1 = 10;
    size1 = defaultSize1;
    size1Signal = 0;


    // switch color palettes
    usesColorPalette = true;
    numColorPalettes = palettes.length;

    // adjust rotation speed
    usesSpeed = true;
    minSpeed = -30;
    maxSpeed = 30;
    defaultSpeed = 5;
    speed = defaultSpeed;

    // TODO: modes: jags, sines...

  }
  
  @Override
  public void init() {
    lineColorIndex = new int[(int)maxSize0];

    for (int i = 0; i < (int)maxSize0; i++) {
      lineColorIndex[i] = (int)random(3) + 1;
    }

    lineWidth = width * 1.5f;
  }

  float rot = 0;
  public @Override
  void display(float[] signals) {
    background(palettes[colorPalette][0]);

    noFill();

    int segments = (int)(lineWidth / segmentLength);

    translate(width / 2, height / 2);
    rotate(rot);
    rot += speed / 1000;

    int numLines = round(size0);

    for (int l = 0; l < numLines; l++) {

      float lineY = l * lineSpacing - (numLines * lineSpacing ) / 2;
      stroke(palettes[colorPalette][lineColorIndex[l]]);

      // strokeWeight(4);
      // float yoff = sin((float)frameCount / 20) * segmentLength / 2;
      // float yoff = sin(frameCount / 10.0 + l * 0.1) * segmentLength / 2;
      // float yoff = sin(frameCount / 10.0) * segmentLength / 2; yoff *= (1 + 0.2 * l);

      float yoff = map(signals[5], 0, 100, 0, segmentLength * 1.5f);
      strokeWeight(map(signals[size1Signal], 0, 100, minSize1, size1));

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


  @Override
  public float setSpeed(float value, boolean normalized) {
    speed = normalized ? value : map(value, 0, 127, minSpeed, maxSpeed);
    println("speed changed to " + speed);
    return speed;
  }


  @Override
  public float setSize0(float value, boolean normalized) {
    size0 = normalized ? value : map(value, 0, 127, minSize0, maxSize0);
    println("size0 changed to " + size0);
    return size0;
  }

  @Override
  public float setSize1(float value, boolean normalized) {
    size1 = normalized ? value : map(value, 0, 127, minSize1, maxSize1);
    println("size1 changed to " + size1);
    return size1;
  }

  @Override
  public float setColorPalette(float value, boolean normalized) {
    colorPalette = normalized ? round(value) : round(map(value, 0, 127, 0, numColorPalettes - 1));
    println("color palette changed to " + colorPalette);
    return (float)colorPalette;
  }




}
// modes:
// points/circles, not lines?
// triangle strip!?



public class ParametricLines extends VizBase
{
  // private PVector p;
  private float scale = 250; // TODO: make relative to size of canvas?

  private float alpha;
  private float size0;
  private float size1;
  private int colorPalette = 0;
  private float colorAdjustment;
  private int mode = 0;
  private float x0;
  // private int size0Signal = 0; // length of tail
  // private int size1Signal = 0; // thickness
  
  public ParametricLines(PApplet parentApplet) {
    super(parentApplet);
    name = "Parametric Lines";

    // initialize controls

    usesSize0 = true;
    minSize0 = 1;
    maxSize0 = 255;
    defaultSize0 = 50;
    size0 = defaultSize0;

    usesSize1 = true;
    minSize1 = 1;
    maxSize1 = 255;
    defaultSize1 = 50;
    size1 = defaultSize1;

    usesColorPalette = true;
    numColorPalettes = 2;

    usesColorAdjustment = true;
    minColorAdjustment = 0;
    maxColorAdjustment = 255;
    defaultColorAdjustment = 255;
    colorAdjustment = defaultColorAdjustment;

    usesAlpha = true;
    minAlpha = 0;
    maxAlpha = 255;
    defaultAlpha = 100;
    alpha = defaultAlpha;

    usesMode = true;
    numModes = 4;

    usesX0 = true;
    minX0 = 1;
    maxX0 = 30;
    defaultX0 = 13;
    x0 = defaultX0;
  }
  
  @Override
  public void init() {
    colorMode(HSB, 256);
  }

  public @Override
  void display(float[] signals) {
    translate(width / 2, height / 2);

    int backgroundColor;
    if (colorPalette == 0) {
      backgroundColor = 0;
    }
    else {
      backgroundColor = 255;
    }
    background(backgroundColor);

    if (mode == 2) {
      beginShape(TRIANGLE_STRIP);
    }

    if (mode == 3) {
      beginShape();
      noFill();
      strokeWeight(5);

      stroke(255, 255, 255);
      for (float i = 0; i < TWO_PI * 100; i += PI / 10) {
        vertex(x1(i), y1(i));
      }

      stroke(64, 255, 255);
      for (float i = 0; i < TWO_PI * 100; i += PI / 10) {
        vertex(x2(i), y2(i));
      }

      endShape();
    }
    else {
      for(int i = 0; i < (int) map(signals[size0Signal], 0, 100, 0, size0); i++) {
        // strokeWeight(5);
        if (mode == 0) {
          noFill();
          strokeWeight(pow(map(signals[5], 0, 100, 0, sqrt(size1)), 2));
          strokeCap(SQUARE);
          stroke((frameCount + i) % 256, colorAdjustment, 256, map(signals[alphaSignal], 0, 100, alpha, 255));
          line(x1(frameCount + i), y1(frameCount + i), x2(frameCount + i), y2(frameCount + i));
        }
        else if (mode == 1) {
          noStroke();
          fill((frameCount + i) % 256, colorAdjustment, 256, map(signals[alphaSignal], 0, 100, alpha, 255));
          ellipse(x1(frameCount + i), y1(frameCount + i), size1, size1);
          ellipse(x2(frameCount + i), y2(frameCount + i), size1, size1);
        }
        else if (mode == 2) {
          noFill();
          strokeWeight(pow(map(signals[5], 0, 100, 0, sqrt(size1)), 2));
          strokeCap(SQUARE);
          stroke((frameCount + i) % 256, colorAdjustment, 256, map(signals[alphaSignal], 0, 100, alpha, 255));
          vertex(x1(frameCount + i), y1(frameCount + i));
          vertex(x2(frameCount + i), y2(frameCount + i));
        }
      }
    }


    if (mode == 2) {
      endShape();
    }

  }

  public float x1(float t) {
    return cos(t / x0) * scale + sin(t / 80) * 30;
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
  public float setSize0(float value, boolean normalized) {
    size0 = normalized ? value : map(value, 0, 127, minSize0, maxSize0);
    println("size0 changed to " + size0);
    return size0;
  }

  @Override
  public float setSize1(float value, boolean normalized) {
    size1 = normalized ? value : map(value, 0, 127, minSize1, maxSize1);
    println("size1 changed to " + size1);
    return size1;
  }

  @Override
  public float setColorPalette(float value, boolean normalized) {
    colorPalette = normalized ? round(value) : round(map(value, 0, 127, 0, numColorPalettes - 1));
    println("color palette changed to " + colorPalette);
    return (float)colorPalette;
  }

  @Override
  public float setColorAdjustment(float value, boolean normalized) {
    colorAdjustment = normalized ? value : map(value, 0, 127, minColorAdjustment, maxColorAdjustment);
    println("color adjustment changed to " + colorAdjustment);
    return colorAdjustment;
  }

  @Override
  public float setAlpha(float value, boolean normalized) {
    alpha = normalized ? value : map(value, 0, 127, 0, 255);
    println("alpha changed to " + alpha);
    return alpha;
  }

  @Override
  public void setAlphaSignal(int value) {
    alphaSignal = value;
  }

  @Override
  public float setMode(float value, boolean normalized) {
    mode = normalized ? round(value) : round(map(value, 0, 127, 0, numModes - 1));
    println("mode changed to " + mode);
    return (float)mode;
  }

  @Override
  public float setX0(float value, boolean normalized) {
    x0 = normalized ? value : map(value, 0, 127, minX0, maxX0);
    println("x0 changed to " + x0);
    return x0;
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

// Some ideas
// - Bar length reacts to music (assign random FFT)
// - different circles rotate at different rates, including opposite directions
// - color palettes obviously
// - wiggly borders
// - shape themes (drawn shapes; letters; emoji; igor heads)
// - ring zoom
// - alternate ring types, like in that Black viz

// color palettes
// - black white
// - rings are colored
// - individual lines are colored




public class Rings extends VizBase
{  
  private float[] ringRotationSpeed;
  private boolean[] ringDisabled;

  private List<List<Integer>> ringParticleColors;

  public Rings(PApplet parentApplet) {
    super(parentApplet);
    name = "Rings";

    usesSize0 = true;
    minSize0 = 1;
    maxSize0 = 20;
    defaultSize0 = 5;
    size0 = defaultSize0;

    usesSize1 = true;
    minSize1 = 0.1f;
    maxSize1 = 10;
    defaultSize1 = 1;
    size1 = defaultSize1;

    usesColorPalette = true;
    numColorPalettes = 3;
    // 0: rings are static colors
    // 1: rings rotate through color space
    // TODO 2: each particle is a random color
    // TODO up: preset palettes

    usesColorAdjustment = true;
    minColorAdjustment = 0;
    maxColorAdjustment = 255;
    defaultColorAdjustment = 0;
    colorAdjustment = defaultColorAdjustment;


    usesMode = true;
    numModes = 4;

    // TODO: use x0 to control density
    usesX0 = true;
    minX0 = 0.1f;
    maxX0 = 3;
    defaultX0 = 1.0f;
    x0 = defaultX0;

    usesZ0 = true;
    minZ0 = 0.1f;
    maxZ0 = 3;
    defaultZ0 = 1;
    z0 = defaultZ0;

    usesSpeed = true;
    minSpeed = 0.1f;
    maxSpeed = 3;
    defaultSpeed = 1;
    speed = defaultSpeed;
  }
  
  @Override
  public void init() {
    randomizeRingSettings();
    colorMode(HSB, 255);
  }

  public @Override
  void display(float[] signals) {

    int numSignals = signals.length;

    background(0);
    rectMode(CENTER);
    noStroke();
    fill(255);

    translate(width / 2, height / 2);

    pushMatrix();
    scale(z0);


    // draw each ring
    for (int ringCount = 0; ringCount < size0; ringCount++) {
      int rectId = 0;

      if (colorPalette == 0) {
        fill(ringCount % 5 / 5.0f * 255, colorAdjustment, 255);
      }
      else if(colorPalette == 1) {
        fill((ringCount % 5 / 5.0f * 255 + millis() / 20.0f) % 255, colorAdjustment, 255); 
      }

      // draw ring particles
      for (float i = 0; i < TWO_PI; i += TWO_PI / (20 * (ringCount + 1) / x0)) {
        pushMatrix();

        float rot = 0;
        if (mode == 1) {
          rot = i + millis() / 400.0f / ringRotationSpeed[ringCount] * speed;
        }
        else if (mode == 2){
          rot = (i / ringRotationSpeed[ringCount]) + millis() / 400.0f * speed;
        }
        else {
          rot = i + millis() / 400.0f * speed;
        }

        rotate(rot);

        if (!(mode == 3 && ringDisabled[ringCount])) {
          rect(20 * (ringCount + 1), 0, signals[rectId % numSignals] / 10.0f * size1, 3);
        }

        popMatrix();
        rectId++;
      }
    }

    popMatrix();
  }


  private void randomizeRingSettings() {
    int ringCount = (int)maxSize0;

    ringRotationSpeed = new float[ringCount];
    ringDisabled = new boolean[ringCount];

    for (int i = 0; i < ringCount; i++) {
      float rotSpeed = 1.0f;
      boolean disabled = false;

      switch ((int)random(6)) {
        case 0:
          rotSpeed = 1.0f;
          break;
        case 1:
          rotSpeed = -1.0f;
          break;
        case 2:
          rotSpeed = 2.0f;
          break;
        case 3:
          rotSpeed = -2.0f;
          break;
        case 4:
          rotSpeed = 4.0f;
          break;
        case 5:
          rotSpeed = -4.0f;
          break;
      }
      ringRotationSpeed[i] = rotSpeed;

      if ((int)random(4) == 0) {
        disabled = true;
      }
      ringDisabled[i] = disabled;
    }
  }


  @Override
  public float setSize0(float value, boolean normalized) {
    size0 = normalized ? value : map(value, 0, 127, minSize0, maxSize0);
    println("size0 changed to " + size0);
    return size0;
  }

  @Override
  public float setSize1(float value, boolean normalized) {
    size1 = normalized ? value : map(value, 0, 127, minSize1, maxSize1);
    println("size1 changed to " + size0);
    return size1;
  }


  @Override
  public float setX0(float value, boolean normalized) {
    x0 = normalized ? value : map(value, 0, 127, minX0, maxX0);
    println("x0 changed to " + x0);
    return x0;
  }


  @Override
  public float setZ0(float value, boolean normalized) {
    z0 = normalized ? value : map(value, 0, 127, minZ0, maxZ0);
    println("z0 changed to " + z0);
    return z0;
  }

  @Override
  public float setMode(float value, boolean normalized) {
    mode = normalized ? round(value) : round(map(value, 0, 127, 0, numModes - 1));
    println("mode changed to " + mode);
    return (float)mode;
  }

  @Override
  public float setSpeed(float value, boolean normalized) {
    speed = normalized ? value : map(value, 0, 127, minSpeed, maxSpeed);
    println("speed changed to " + speed);
    return speed;
  }


  @Override
  public float setColorPalette(float value, boolean normalized) {
    colorPalette = normalized ? round(value) : round(map(value, 0, 127, 0, numColorPalettes - 1));
    println("color palette changed to " + colorPalette);
    return (float)colorPalette;
  }

  @Override
  public float setColorAdjustment(float value, boolean normalized) {
    colorAdjustment = normalized ? value : map(value, 0, 127, minColorAdjustment, maxColorAdjustment);
    println("color adjustment changed to " + colorAdjustment);
    return colorAdjustment;
  }


}



public class Speaker extends VizBase
{  
  public Speaker(PApplet parentApplet) {
    super(parentApplet);
    name = "Speaker";
  }
  
  @Override
  public void init() {
  }

  public @Override
  void display(float[] signals) {
    background(0);

    translate(width / 2, height / 2);
    ellipseMode(RADIUS);

    colorMode(HSB);
    stroke(255);
    strokeWeight(1);
    fill(100, 255, 100, map(signals[0], 0, 100, 0, 255));

    for (float i = 0; i < TWO_PI; i += TWO_PI / 30) {
      pushMatrix();
      rotate(i);
      ellipse(100, 0, 100, 100);
      popMatrix();
    }
  }
}




public class Text extends VizBase
{  
  RFont font;
  PImage img;

  int fontSize = 200;

  public Text(PApplet parentApplet) {
    super(parentApplet);
    name = "Text";

    RG.init(parentApplet);

    img = loadImage("igortransparent.png");

    usesMode = true;
    numModes = 3;

    // displayText
    usesDisplayText = true;
    defaultDisplayText = "HOWDY";
    displayText = defaultDisplayText;

    // fontSize
    usesSize0 = true;
    minSize0 = 10;
    maxSize0 = 400;
    defaultSize0 = 200;
    size0 = defaultSize0;

    // object base size
    usesSize1 = true;
    minSize1 = 1;
    maxSize1 = 100;
    defaultSize1 = 5;
    size1 = defaultSize1;

    // sensitivity
    usesSensitivity = true;
    minSensitivity = 0;
    maxSensitivity = 1;
    defaultSensitivity = 0.5f;
    sensitivity = defaultSensitivity;
  }
  
  @Override
  public void init() {
    // allways initialize the library in setup
    font = new RFont("FreeSans.ttf", fontSize, RFont.CENTER);

    RCommand.setSegmentLength(11);
    RCommand.setSegmentator(RCommand.UNIFORMLENGTH);
  }

  public @Override
  void display(float[] signals) {
    if (mode == 2) {
      colorMode(HSB, 255);
      background(millis() / 10.0f % 255, 100, 200);
    }
    else {
      background(0);
    }

    if (fontSize != size0) {
      fontSize = (int)size0;
      font = new RFont("FreeSans.ttf", fontSize, RFont.CENTER);
    }

    translate(width / 2, height / 2 + fontSize / 3);

    if (displayText.length() > 0) {
      // get the points on font outline
      RGroup grp;
      grp = font.toGroup(displayText);
      grp = grp.toPolygonGroup();
      RPoint[] pnts = grp.getPoints();

      // // lines
      // stroke(181, 157, 0);
      // strokeWeight(1.0);
      // for (int i = 0; i < pnts.length; i++ ) {
      //   float l = 5;
      //   line(pnts[i].x-l, pnts[i].y-l, pnts[i].x+l, pnts[i].y+l);
      // }

      // dots
      if (mode == 0) {
        fill(255);
        noStroke();
      }
      else if (mode == 1) {
        noFill();
        stroke(255);
      }
      for (int i = 0; i < pnts.length; i++ ) {
        float diameter = signals[i % 9] * sensitivity + size1;
        if (mode == 1) {
          strokeWeight(signals[i % 9] / 10.0f * sensitivity);
        }

        if (mode == 0 || mode == 1) {
          ellipse(pnts[i].x, pnts[i].y, diameter, diameter);
        }
        else if (mode == 2) {
          float imgWidth = diameter;

          image(img, pnts[i].x - imgWidth / 2, pnts[i].y - imgWidth / 2, imgWidth, imgWidth);
          // image(img, pnts[i].x, pnts[i].y);
        }
      }
    }
  }


  @Override
  public void setDisplayText(String text) {
    displayText = text;
  }





  @Override
  public float setSize0(float value, boolean normalized) {
    size0 = normalized ? value : map(value, 0, 127, minSize0, maxSize0);
    println("size0 changed to " + size0);
    return size0;
  }



  @Override
  public float setSize1(float value, boolean normalized) {
    size1 = normalized ? value : map(value, 0, 127, minSize1, maxSize1);
    println("size1 changed to " + size0);
    return size1;
  }


  @Override
  public float setMode(float value, boolean normalized) {
    mode = normalized ? round(value) : round(map(value, 0, 127, 0, numModes - 1));
    println("mode changed to " + mode);
    return (float)mode;
  }


  @Override
  public float setSensitivity(float value, boolean normalized) {
    sensitivity = normalized ? value : map(value, 0, 127, minSensitivity, maxSensitivity);
    println("sensitivity changed to " + sensitivity);
    return sensitivity;
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

    // sensitivity
    usesSensitivity = true;
    minSensitivity = 0;
    maxSensitivity = 10;
    defaultSensitivity = 1;
    sensitivity = defaultSensitivity;

    usesMode = true;
    numModes = 6;

  }
  
  @Override
  public void init() {
    img = loadImage("toph.jpg");
  }

  public @Override
  void display(float[] signals) {
    ellipseMode(CENTER);

    if (mode == 0) {
      if (frameCount % 10 != 0) {
        return;
      }
    }

    background(255);

    // assume height-constrained
    float tileWidth = height / (float) img.height; // use width as height for square pixels
    translate(width / 2 - ((img.width * tileWidth) / 2), 0);

    for (int gridX = 0; gridX < img.width; gridX++) {
      for (int gridY = 0; gridY < img.height; gridY++) {
        float posX = tileWidth * gridX;
        float posY = tileWidth * gridY;
        
        int c = img.pixels[gridY * img.width + gridX];
        int greyscale = round(red(c) * 0.222f + green(c) * 0.707f + blue(c) * 0.071f);
        float w = map(greyscale, 0, 255, 10, 0);
        noStroke();
        fill(c);

        if (mode == 1) {
          ellipse(posX, posY, w * signals[0] / 100.0f * sensitivity, w * signals[0] / 100.0f * sensitivity);
        }
        else if (mode == 0) {
          float sizeAdjust = random(1); 
          ellipse(posX, posY, w * sizeAdjust, w * sizeAdjust);
        }
        else if (mode == 2) {
          fill(255 - greyscale);
          ellipse(posX, posY, w * signals[(gridX + gridY) % 9] / 100.0f * sensitivity, w * signals[(gridX + gridY) % 9] / 100.0f * sensitivity);
        }
        else if (mode == 3) {
          fill(greyscale);
          ellipse(posX, posY, w * signals[gridX * gridY % 9] / 100.0f * sensitivity, w * signals[gridX * gridY % 9] / 100.0f * sensitivity);
        }
        else if (mode == 4) {
          float w5 = map(greyscale,0,255,5,0.2f);
          strokeWeight(w5 * signals[0] / 100.0f * sensitivity + 0.1f);
          // get neighbour pixel, limit it to image width
          int c2 = img.get(min(gridX+1,img.width-1), gridY);
          stroke(c2);
          int greyscale2 = PApplet.parseInt(red(c2)*0.222f + green(c2)*0.707f + blue(c2)*0.071f);
          float h5 = 5 * signals[0] / 100.0f;
          float d1 = map(greyscale, 0,255, h5,0);
          float d2 = map(greyscale2, 0,255, h5,0);
          line(posX-d1, posY+d1, posX+tileWidth-d2, posY+d2);
        }
        else if (mode == 5) {
          float l3 = map(greyscale, 0,255, 30,0.1f);
          l3 = l3 * signals[0] / 100.0f * sensitivity;   
          stroke(0);
          strokeWeight(10 * signals[0] * sensitivity / 100);
          line(posX, posY, posX+l3, posY+l3);
        }


      }
    }
  }

  @Override
  public float setMode(float value, boolean normalized) {
    mode = normalized ? round(value) : round(map(value, 0, 127, 0, numModes - 1));
    println("mode changed to " + mode);
    return (float)mode;
  }

  @Override
  public float setSensitivity(float value, boolean normalized) {
    sensitivity = normalized ? value : map(value, 0, 127, minSensitivity, maxSensitivity);
    println("sensitivity changed to " + sensitivity);
    return sensitivity;
  }



}

  public void settings() {  size(600, 600); }
  static public void main(String[] passedArgs) {
    String[] appletArgs = new String[] { "viz" };
    if (passedArgs != null) {
      PApplet.main(concat(appletArgs, passedArgs));
    } else {
      PApplet.main(appletArgs);
    }
  }
}
