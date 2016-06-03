import processing.core.*;

public class Jags extends VizBase {
  // visualization-dependent variables
  color   background = #DCD6B2;
  color[] palette = new color[] { #4E7989, #A9011B, #80944E }; // colorlisa - picasso - the dream

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

    lineWidth = width * 1.5;
  }

  @Override
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

      float yoff = map(signals[5], 0, 100, 0, segmentLength * 1.5);
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
