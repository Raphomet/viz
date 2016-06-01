void setup() {
	size(640, 640);
}

void draw() {
  background(0);

  noFill();
  stroke(255);
  strokeWeight(1);

  beginShape();
  curveVertex(100, height / 2);

  for (int i = 0; i < 20; i++) {
    float noiseScale = 100;
    float offset = noise(frameCount + i) * noiseScale - (noiseScale / 2);
    curveVertex(100 + 10 * i, height / 2 + offset);
  }

  curveVertex(540, height / 2);
  endShape();
}