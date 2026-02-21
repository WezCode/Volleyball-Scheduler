// lib/json.ts

/** Download any JS value as a pretty-printed JSON file. */
export function downloadJson(value: any, filename: string) {
    const json = JSON.stringify(value, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
  
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  
    URL.revokeObjectURL(url);
  }
  
  /** Read and parse a JSON file selected via an <input type="file" />. */
  export async function readJsonFile(file: File): Promise<any> {
    const text = await file.text();
    return JSON.parse(text);
  }