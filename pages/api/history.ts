// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { Result } from "../../lib/result";
import { supabaseServer } from "../../lib/supabaseServer";
import { promptsDB } from "./log";

type Data = promptsDB[];

export async function getHistory(id: string): Promise<Result<Data, string>> {
  console.log("Getting history for", id);

  const { data: promptRow, error: promptRowError } = await supabaseServer
    .from("prompts")
    .select("root_id")
    .eq("id", id)
    .single();

  if (promptRowError) {
    console.log(promptRowError);
    return { error: promptRowError.message, data: null };
  }
  console.log("conversation!", promptRow.root_id);
  const { data, error } = await supabaseServer
    .from("prompts")
    .select("*")
    .eq("root_id", promptRow.root_id);

  if (error) {
    console.log(error);
    return { error: error.message, data: null };
  }

  const prompts = data as promptsDB[];

  let history = [];

  let pointer: string | null = id as string;
  while (pointer) {
    const prompt = prompts.find((p) => p.id === pointer);
    if (!prompt) {
      break;
    }
    history.push(prompt);
    pointer = prompt.last_id;
  }
  return { data: history.reverse(), error: null };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data | { error: string }>
) {
  const { id } = req.query;

  console.log("Getting history for", id);
  const { data, error } = await getHistory(id as string);
  if (error !== null) {
    res.status(400).json({ error });
  } else {
    res.status(200).json(data);
  }
}
