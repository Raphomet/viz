import processing.core.*;

public class Jags extends VizBase {
  // colors: must be 4, first one is always background
  // color[] palette = new color[] { #DCD6B2, #4E7989, #A9011B, #80944E };

  color[][] palettes = {
    { #DCD6B2, #4E7989, #A9011B, #80944E },  // colorlisa - picasso - the dream
    { #3F6F76, #69B7CE, #C65840, #F4CE4B },  // colorlisa - chagall
    { #FFFFFF, #FF0061, #E80058, #CE004E },  // colorfriends - sexual addiction
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

    lineWidth = width * 1.5;
  }

  float rot = 0;
  @Override
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

      float yoff = map(signals[5], 0, 100, 0, segmentLength * 1.5);
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
