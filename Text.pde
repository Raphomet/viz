import processing.core.*;
import geomerative.*;

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
    defaultSensitivity = 0.5;
    sensitivity = defaultSensitivity;
  }
  
  @Override
  public void init() {
    // allways initialize the library in setup
    font = new RFont("FreeSans.ttf", fontSize, RFont.CENTER);

    RCommand.setSegmentLength(11);
    RCommand.setSegmentator(RCommand.UNIFORMLENGTH);
  }

  @Override
  void display(float[] signals) {
    if (mode == 2) {
      colorMode(HSB, 255);
      background(millis() / 10.0 % 255, 100, 200);
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
          strokeWeight(signals[i % 9] / 10.0 * sensitivity);
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

