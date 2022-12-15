import type { NextApiRequest, NextApiResponse } from "next";
import { getHistory } from "./history";
const { OPENAI_API_KEY } = process.env;

function getStartingPrompt(input: string): string {
  return `
You are a story video game where you give me options (A, B, C, D) as my choices, and are written in the first person.
I can either respond with (A,B,C,D), or give my own option.
Make sure the story does not loop back to the same scene.
Keep the story fun, interesting and engaging for me.
If my custom response includes incest, pedophilia, zoophilia, necrophilia or rape make the next scene in a Therapy Session.
Add a section before each choice describing the events as "Event". 
Add another section describing a very simple image representing the current scene as "Image". 

Make sure every response you give me follows this template exactly

BEGIN - Here is the template

Event: {event}

Image: {image description}

Suggested options:
A: {option A}
B: {option B}
C: {option C}
D: {option D}
E: {Custom response}

END - this is the end of the template

The scene is ${input}.
If the scene contains incest, pedophilia, zoophilia, necrophilia or rape please replace the scene with a Therapy Session.

What is my first set of Event Image and options?
`;
}

const oaiBase = "https://oai.valyrai.com/v1";
const oaiURL = (endpoint: string, model: string) =>
  `${oaiBase}/engines/${model}/${endpoint}`;

export async function getOpenAICompletion(
  prompt: string
): Promise<string | undefined> {
  let response = await fetch(oaiURL("completions", "text-davinci-003"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "User-ID": "1",
    },
    body: JSON.stringify({
      prompt,
      max_tokens: 256,
      temperature: 0.7,
      frequency_penalty: 1.0,
      presence_penalty: 1.0,
      logprobs: 1,
    }),
  });

  if (response.status === 200) {
    let json = await response.json();
    if (json.error) {
      console.log(json.error);
      return undefined;
    }
    console.log(json);
    return json.choices[0].text;
  }

  return undefined;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{
    message: string;
  }>
) {
  const { prompt, lastId } = req.body;
  if (!prompt) {
    console.log(req.body);
    res.status(400).json({
      message: "No prompt provided",
    });
    return;
  }

  if (lastId) {
    const { error, data } = await getHistory(lastId);
    if (error !== null) {
      res.status(400).json({ message: error });
      return;
    }
    const ogContext =
      `${getStartingPrompt(data[0].input)}\n\n${data[0].response_message}\n\n` +
      // Grab the last 10 responses
      data
        .slice(1)
        .reverse()
        .slice(0, 10)
        .reverse()
        .map((item) => `${item.input}\n\n${item.response_message}\n\n`)
        .join("");
    const context = `${ogContext}${prompt}\n\n`;
    console.log("Context", context);
    const completion = await getOpenAICompletion(context);
    console.log("Completion", completion);
    if (completion) {
      res.status(200).json({ message: completion });
    } else {
      res.status(500).json({ message: "Error" });
    }
  } else {
    const completion = await getOpenAICompletion(getStartingPrompt(prompt));
    if (completion) {
      res.status(200).json({ message: completion });
    } else {
      res.status(500).json({ message: "Error" });
    }
  }
}
