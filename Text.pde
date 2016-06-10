import processing.core.*;
import geomerative.*;

public class Text extends VizBase
{  
  color[][] palettes = {
    { #DCD6B2, #4E7989, #A9011B, #80944E, #DCD6B2 },  // colorlisa - picasso - the dream
    { #3F6F76, #69B7CE, #C65840, #F4CE4B, #62496F },  // colorlisa - chagall
    { #69D2E7, #A7DBD8, #E0E4CC, #F38630, #FA6900 },
    { #FE4365, #FC9D9A, #F9CDAD, #C8C8A9, #83AF9B },
    { #ECD078, #D95B43, #C02942, #542437, #53777A },
    { #556270, #4ECDC4, #C7F464, #FF6B6B, #C44D58 },
    { #774F38, #E08E79, #F1D4AF, #ECE5CE, #C5E0DC },
    { #E8DDCB, #CDB380, #036564, #033649, #031634 },
    { #594F4F, #547980, #45ADA8, #9DE0AD, #E5FCC2 },
    { #00A0B0, #6A4A3C, #CC333F, #EB6841, #EDC951 },
    { #E94E77, #D68189, #C6A49A, #C6E5D9, #F4EAD5 },
    { #3FB8AF, #7FC7AF, #DAD8A7, #FF9E9D, #FF3D7F },
    { #D9CEB2, #948C75, #D5DED9, #7A6A53, #99B2B7 },
    { #FFFFFF, #CBE86B, #F2E9E1, #1C140D, #CBE86B },
    { #EFFFCD, #DCE9BE, #555152, #2E2633, #99173C },
    { #343838, #005F6B, #008C9E, #00B4CC, #00DFFC },
    { #413E4A, #73626E, #B38184, #F0B49E, #F7E4BE },
    { #99B898, #FECEA8, #FF847C, #E84A5F, #2A363B },
    { #FF4E50, #FC913A, #F9D423, #EDE574, #E1F5C4 },
    { #655643, #80BCA3, #F6F7BD, #E6AC27, #BF4D28 },
    { #351330, #424254, #64908A, #E8CAA4, #CC2A41 },
    { #00A8C6, #40C0CB, #F9F2E7, #AEE239, #8FBE00 },
    { #554236, #F77825, #D3CE3D, #F1EFA5, #60B99A }
  };
  

  RFont font;
  PImage img;

  int fontSize = 200;

  public Text(PApplet parentApplet) {
    super(parentApplet);
    name = "Text";

    RG.init(parentApplet);

    img = loadImage("igortransparent.png");

    usesMode = true;
    numModes = 5;

    // displayText
    usesDisplayText = true;
    defaultDisplayText = "";
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

    // switch color palettes
    usesColorPalette = true;
    numColorPalettes = palettes.length;


    // adjust rotation speed
    usesSpeed = true;
    minSpeed = 0;
    maxSpeed = 0.05;
    defaultSpeed = 0;
    speed = defaultSpeed;

  }
  
  @Override
  public void init() {
    font = new RFont("FreeSans.ttf", fontSize, RFont.CENTER);

    RCommand.setSegmentLength(11);
    RCommand.setSegmentator(RCommand.UNIFORMLENGTH);
  }

  @Override
  void display(float[] signals) {
    if (mode == 4 ) {
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


    int channelOffset = 0;

    if (speed != 0) {
      channelOffset = (int)(millis() * speed);
    }

    if (displayText.length() > 0) {
      // get the points on font outline
      RGroup grp;
      grp = font.toGroup(displayText);
      grp = grp.toPolygonGroup();
      RPoint[] pnts = grp.getPoints();

      // dots
      if (mode == 0) {
        fill(255);
        noStroke();
      }
      if (mode == 1) {
        noStroke();
      }
      else if (mode == 2) {
        noFill();
        stroke(255);
      }
      else if (mode == 3) {
        noFill();
      }
      for (int i = 0; i < pnts.length; i++ ) {
        float diameter = signals[(i + channelOffset) % 9] * sensitivity + size1;
        if (mode == 2 || mode == 3) {
          strokeWeight(signals[(i + channelOffset) % 9] / 10.0 * sensitivity);
        }

        if (mode == 1) {
          fill(palettes[colorPalette][i % 5]);
        }

        if (mode == 3) {
          stroke(palettes[colorPalette][i % 5]);
        }

        if (mode == 4) {
          float imgWidth = diameter;
          image(img, pnts[i].x - imgWidth / 2, pnts[i].y - imgWidth / 2, imgWidth, imgWidth);
        }
        else {
          ellipse(pnts[i].x, pnts[i].y, diameter, diameter);
        }
      }
    }
  }

  private void shuffleCurrentColors()
  {
    color[] ar = palettes[colorPalette];
    Random rnd = new Random();
    for (int i = ar.length - 1; i > 0; i--)
    {
      int index = rnd.nextInt(i + 1);
      // Simple swap
      color a = ar[index];
      ar[index] = ar[i];
      ar[i] = a;
    }
  }


  @Override
  public void buttonShuffleColorsPressed() {
    shuffleCurrentColors();
  }

  @Override
  public void buttonResetSpeedPressed() {
    speed = defaultSpeed;
  }


  @Override
  public void setDisplayText(String text) {
    displayText = text;
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

  @Override
  public float setColorPalette(float value, boolean normalized) {
    colorPalette = normalized ? round(value) : round(map(value, 0, 127, 0, numColorPalettes - 1));
    println("color palette changed to " + colorPalette);
    return (float)colorPalette;
  }


}

