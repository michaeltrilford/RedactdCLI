import readline from 'node:readline';
import { createInterface } from 'node:readline/promises';

function clearLines(count) {
  if (count <= 0) return;

  process.stdout.write(`\x1b[${count}A`);
  for (let i = 0; i < count; i += 1) {
    process.stdout.write('\r\x1b[2K');
    if (i < count - 1) {
      process.stdout.write('\x1b[1B');
    }
  }
  process.stdout.write(`\x1b[${count - 1}A\r`);
}

export async function selectPrompt({ colors, title, subtitle, options, initialIndex = 0 }) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return options[initialIndex]?.value;
  }

  let index = Math.max(0, Math.min(initialIndex, options.length - 1));
  let renderedLines = 0;

  const render = () => {
    const lines = [];
    lines.push(colors.accent(title));
    if (subtitle) {
      lines.push(colors.subtle(subtitle));
    }

    for (let i = 0; i < options.length; i += 1) {
      const option = options[i];
      const cursor = i === index ? colors.accent('›') : colors.subtle(' ');
      const label = i === index ? colors.text(option.label) : colors.muted(option.label);
      lines.push(`${cursor} ${label}`);
      if (option.description) {
        lines.push(colors.subtle(`  ${option.description}`));
      }
    }

    if (renderedLines > 0) {
      clearLines(renderedLines);
    }

    process.stdout.write(lines.join('\n') + '\n');
    renderedLines = lines.length;
  };

  render();
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return await new Promise((resolve, reject) => {
    const cleanup = () => {
      process.stdin.off('keypress', onKeypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };

    const finish = (value) => {
      cleanup();
      clearLines(renderedLines);
      resolve(value);
    };

    const onKeypress = (_str, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Interactive selection cancelled.'));
        return;
      }

      if (key.name === 'up') {
        index = index === 0 ? options.length - 1 : index - 1;
        render();
        return;
      }

      if (key.name === 'down') {
        index = index === options.length - 1 ? 0 : index + 1;
        render();
        return;
      }

      if (key.name === 'return') {
        finish(options[index].value);
      }
    };

    process.stdin.on('keypress', onKeypress);
  });
}

export async function inputPrompt({ colors, title, subtitle, defaultValue = '' }) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    if (title) {
      console.log(colors.accent(title));
    }
    if (subtitle) {
      console.log(colors.subtle(subtitle));
    }

    const suffix = defaultValue ? ` (${defaultValue})` : '';
    const value = await rl.question(colors.text(`Path${suffix}: `));
    const trimmed = value.trim();
    return trimmed || defaultValue;
  } finally {
    rl.close();
  }
}

export async function pathPrompt({ colors, title, subtitle, label = 'Path', defaultValue = '' }) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    if (title) {
      console.log(colors.accent(title));
    }
    if (subtitle) {
      console.log(colors.subtle(subtitle));
    }

    const suffix = defaultValue ? ` (${defaultValue})` : '';
    const value = await rl.question(colors.text(`${label}${suffix}: `));
    const trimmed = value.trim();
    return trimmed || defaultValue;
  } finally {
    rl.close();
  }
}

export async function passwordPrompt({ colors, title, subtitle, label = 'API key' }) {
  if (title) {
    console.log(colors.accent(title));
  }
  if (subtitle) {
    console.log(colors.subtle(subtitle));
  }

  process.stdout.write(colors.text(`${label}: `));
  readline.emitKeypressEvents(process.stdin);

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdin.resume();

  return await new Promise((resolve, reject) => {
    let value = '';

    const cleanup = () => {
      process.stdin.off('keypress', onKeypress);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
      process.stdout.write('\n');
    };

    const onKeypress = (str, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Password entry cancelled.'));
        return;
      }

      if (key.name === 'return') {
        cleanup();
        resolve(value);
        return;
      }

      if (key.name === 'backspace') {
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }

      if (typeof str === 'string' && str.length > 0 && !key.meta) {
        value += str;
        process.stdout.write('*');
      }
    };

    process.stdin.on('keypress', onKeypress);
  });
}
