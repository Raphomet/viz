import processing.core.*;

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

  @Override
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
        
        color c = img.pixels[gridY * img.width + gridX];
        int greyscale = round(red(c) * 0.222 + green(c) * 0.707 + blue(c) * 0.071);
        
        float w = map(greyscale, 0, 255, 10, 0);
        noStroke();
        fill(c);
        
        float sizeAdjust = random(1);
        
        ellipse(posX, posY, w * sizeAdjust, w * sizeAdjust);
      }
    }
  }
}

