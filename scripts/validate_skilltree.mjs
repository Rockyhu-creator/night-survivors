#!/usr/bin/env node
/**
 * 技能树数据完整性校验护栏 —— 《夜裔幸存者》
 *
 * 目的：防止「节点 prereq 指向不存在的节点」等数据断裂 bug 悄悄进入代码。
 * 该脚本由 package.json 的 prebuild 钩子自动执行，校验失败会直接让 build 失败。
 *
 * 校验项：
 *   a. 必填字段  —— id/branch/type/name/icon/desc/cost/prereq 齐全，prereq 必须是数组
 *   b. 唯一 id   —— 无重复 id
 *   c. prereq 存在性 —— 每个 prereq 都必须指向真实存在的节点（核心防护目标）
 *   d. 二叉约束  —— prereq.length <= 2
 *   e. 无环 + 可达 —— 每分支恰有一个 root；prereq 不跨分支；无环；全节点可达
 *   f. gateReq 合法 —— gateReq.cleared 的值 ∈ DIFFICULTIES 的 key；gateReq.achievement 必须是数组
 *
 * 退出码：0 = 通过；1 = 存在问题（详情打印到 stderr）
 *
 * 用法：node scripts/validate_skilltree.mjs   （可从任意 cwd 运行）
 */

// 用 import.meta.url 解析绝对路径，确保从任意工作目录都能正确导入
const dataUrl = new URL('../src/data.js', import.meta.url);
const { SKILL_TREE, DIFFICULTIES } = await import(dataUrl.href);

/** 收集到的错误信息；非空即判定失败 */
const errors = [];
const fail = (check, msg) => errors.push(`[${check}] ${msg}`);

// ── 前置健全性：SKILL_TREE 必须是非空数组 ────────────────────────────────
if (!Array.isArray(SKILL_TREE) || SKILL_TREE.length === 0) {
  console.error('✗ 技能树校验失败：SKILL_TREE 必须是非空数组，实际为', typeof SKILL_TREE);
  process.exit(1);
}

const nodes = SKILL_TREE;
const REQUIRED_FIELDS = ['id', 'branch', 'type', 'name', 'icon', 'desc', 'cost', 'prereq'];

// ── a. 必填字段 ──────────────────────────────────────────────────────────
nodes.forEach((node, i) => {
  const label = node && node.id ? `节点 ${node.id}` : `索引 [${i}] 的节点`;
  if (!node || typeof node !== 'object') {
    fail('a-必填字段', `${label} 不是对象`);
    return;
  }
  for (const field of REQUIRED_FIELDS) {
    if (node[field] === undefined || node[field] === null) {
      fail('a-必填字段', `${label} 缺少必填字段 "${field}"`);
    }
  }
  if (node.prereq !== undefined && !Array.isArray(node.prereq)) {
    fail('a-必填字段', `${label} 的 prereq 必须是数组，实际为 ${typeof node.prereq}`);
  }
  if (node.cost !== undefined && typeof node.cost !== 'number') {
    fail('a-必填字段', `${label} 的 cost 必须是数字，实际为 ${typeof node.cost}`);
  }
});

// ── b. 唯一 id ───────────────────────────────────────────────────────────
const seen = new Set();
const duplicates = new Set();
for (const node of nodes) {
  if (!node || node.id === undefined) continue;
  if (seen.has(node.id)) duplicates.add(node.id);
  seen.add(node.id);
}
for (const id of duplicates) {
  const count = nodes.filter((n) => n && n.id === id).length;
  fail('b-唯一id', `id "${id}" 重复出现 ${count} 次`);
}

const idSet = seen;
const byId = new Map(nodes.filter((n) => n && n.id !== undefined).map((n) => [n.id, n]));

// ── c. prereq 存在性（核心防护目标） ─────────────────────────────────────
for (const node of nodes) {
  if (!node || !Array.isArray(node.prereq)) continue;
  for (const p of node.prereq) {
    if (!idSet.has(p)) {
      fail('c-prereq存在性', `节点 ${node.id} → 缺失前置 "${p}"（该 id 不存在于技能树中）`);
    }
  }
}

// ── d. 二叉约束 ──────────────────────────────────────────────────────────
for (const node of nodes) {
  if (!node || !Array.isArray(node.prereq)) continue;
  if (node.prereq.length > 2) {
    fail(
      'd-二叉约束',
      `节点 ${node.id} 拥有 ${node.prereq.length} 个前置（上限 2）：${JSON.stringify(node.prereq)}`
    );
  }
}

// ── f. gateReq 合法性 ────────────────────────────────────────────────────
const difficultyKeys = new Set(Object.keys(DIFFICULTIES || {}));
for (const node of nodes) {
  if (!node || !node.gateReq) continue; // gateReq 允许为 null / 缺省
  const { cleared, achievement } = node.gateReq;
  if (cleared !== undefined) {
    if (!Array.isArray(cleared)) {
      fail('f-gateReq', `节点 ${node.id} 的 gateReq.cleared 必须是数组，实际为 ${typeof cleared}`);
    } else {
      for (const c of cleared) {
        if (!difficultyKeys.has(c)) {
          fail(
            'f-gateReq',
            `节点 ${node.id} 的 gateReq.cleared 含非法难度 "${c}"（合法值：${[...difficultyKeys].join(', ')}）`
          );
        }
      }
    }
  }
  // 成就 id 集合不强制校验，仅确认类型
  if (achievement !== undefined && !Array.isArray(achievement)) {
    fail('f-gateReq', `节点 ${node.id} 的 gateReq.achievement 必须是数组，实际为 ${typeof achievement}`);
  }
}

// ── e. 无环 + 可达 ───────────────────────────────────────────────────────
// 仅在结构性检查（a~d）通过后执行，避免断链/重复数据引发级联噪音错误
const structurallySound = errors.every((e) => !/^\[(a|b|c|d)-/.test(e));

if (structurallySound) {
  // e1. 每分支恰有一个 root（prereq 为空的节点）
  const branches = new Map();
  for (const node of nodes) {
    if (!branches.has(node.branch)) branches.set(node.branch, []);
    branches.get(node.branch).push(node);
  }
  for (const [branch, list] of branches) {
    const roots = list.filter((n) => n.prereq.length === 0).map((n) => n.id);
    if (roots.length !== 1) {
      fail(
        'e-可达性',
        `分支 "${branch}" 应恰有 1 个 root（prereq 为空），实际有 ${roots.length} 个：${JSON.stringify(roots)}`
      );
    }
  }

  // e2. prereq 不得跨分支
  for (const node of nodes) {
    for (const p of node.prereq) {
      const parent = byId.get(p);
      if (parent && parent.branch !== node.branch) {
        fail(
          'e-可达性',
          `节点 ${node.id}（分支 ${node.branch}）的前置 "${p}" 属于其它分支 ${parent.branch}，禁止跨分支依赖`
        );
      }
    }
  }

  // e3. 环检测（prereq 有向图上的 DFS 三色标记）
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map([...idSet].map((id) => [id, WHITE]));
  const stack = [];
  const reportedCycles = new Set();

  const dfs = (id) => {
    color.set(id, GRAY);
    stack.push(id);
    for (const p of byId.get(id).prereq) {
      if (!byId.has(p)) continue;
      if (color.get(p) === GRAY) {
        const cycle = stack.slice(stack.indexOf(p)).concat(p).join(' → ');
        if (!reportedCycles.has(cycle)) {
          reportedCycles.add(cycle);
          fail('e-无环', `检测到前置依赖环：${cycle}`);
        }
      } else if (color.get(p) === WHITE) {
        dfs(p);
      }
    }
    stack.pop();
    color.set(id, BLACK);
  };

  for (const id of idSet) if (color.get(id) === WHITE) dfs(id);

  // e4. 可达性 BFS —— 与运行时 buySkillNode 语义一致：需「全部」前置已解锁（AND）
  if (reportedCycles.size === 0) {
    const unlocked = new Set(nodes.filter((n) => n.prereq.length === 0).map((n) => n.id));
    let grew = true;
    while (grew) {
      grew = false;
      for (const node of nodes) {
        if (unlocked.has(node.id)) continue;
        if (node.prereq.every((p) => unlocked.has(p))) {
          unlocked.add(node.id);
          grew = true;
        }
      }
    }
    for (const node of nodes) {
      if (!unlocked.has(node.id)) {
        fail(
          'e-可达性',
          `节点 ${node.id}（分支 ${node.branch}）不可达：无法从 root 经前置链解锁，前置=${JSON.stringify(node.prereq)}`
        );
      }
    }
  }
}

// ── 结果输出 ────────────────────────────────────────────────────────────
if (errors.length > 0) {
  console.error(`✗ 技能树校验失败：发现 ${errors.length} 个问题\n`);
  for (const e of errors) console.error('  ' + e);
  console.error('\n请修复 src/data.js 中的 SKILL_TREE 后重试。');
  process.exit(1);
}

console.log(`✓ 技能树校验通过：${nodes.length} 节点，无断链/重复/越界/不可达`);
process.exit(0);
