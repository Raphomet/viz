import processing.core.*;

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

    // channel
    usesX0 = true;
    minX0 = 0;
    maxX0 = 8;
    defaultX0 = 0;
    x0 = defaultX0;

  }
  
  @Override
  public void init() {
    img = loadImage("toph.jpg");
  }

  @Override
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
        
        color c = img.pixels[gridY * img.width + gridX];
        int greyscale = round(red(c) * 0.222 + green(c) * 0.707 + blue(c) * 0.071);
        float w = map(greyscale, 0, 255, 10, 0);
        noStroke();
        fill(c);

        if (mode == 1) {
          ellipse(posX, posY, w * signals[0] / 100.0 * sensitivity, w * signals[0] / 100.0 * sensitivity);
        }
        else if (mode == 0) {
          float sizeAdjust = random(1); 
          ellipse(posX, posY, w * sizeAdjust, w * sizeAdjust);
        }
        else if (mode == 2) {
          fill(255 - greyscale);
          ellipse(posX, posY, w * signals[(gridX + gridY) % 9] / 100.0 * sensitivity, w * signals[(gridX + gridY) % 9] / 100.0 * sensitivity);
        }
        else if (mode == 3) {
          fill(greyscale);
          ellipse(posX, posY, w * signals[gridX * gridY % 9] / 100.0 * sensitivity, w * signals[gridX * gridY % 9] / 100.0 * sensitivity);
        }
        else if (mode == 4) {
          float w5 = map(greyscale,0,255,5,0.2);
          strokeWeight(w5 * signals[0] / 100.0 * sensitivity + 0.1);
          // get neighbour pixel, limit it to image width
          color c2 = img.get(min(gridX+1,img.width-1), gridY);
          stroke(c2);
          int greyscale2 = int(red(c2)*0.222 + green(c2)*0.707 + blue(c2)*0.071);
          float h5 = 5 * signals[0] / 100.0;
          float d1 = map(greyscale, 0,255, h5,0);
          float d2 = map(greyscale2, 0,255, h5,0);
          line(posX-d1, posY+d1, posX+tileWidth-d2, posY+d2);
        }
        else if (mode == 5) {
          float l3 = map(greyscale, 0,255, 30,0.1);
          l3 = l3 * signals[0] / 100.0 * sensitivity;   
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

  @Override
  public float setX0(float value, boolean normalized) {
    x0 = normalized ? value : map(value, 0, 127, minX0, maxX0);
    println("x0 changed to " + x0);
    return x0;
  }
}

