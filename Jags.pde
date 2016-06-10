import processing.core.*;

public class Jags extends VizBase {
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
    minSpeed = -10;
    maxSpeed = 10;
    defaultSpeed = 0;
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
