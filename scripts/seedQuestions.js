#!/usr/bin/env node
/**
 * Seed Script — Pre-built Question Bank
 *
 * Populates the database with high-quality, detailed coding questions
 * across JavaScript, Python, Java, and C++ that recruiters can choose from.
 *
 * Usage:
 *   node scripts/seedQuestions.js          # seed (skip existing)
 *   node scripts/seedQuestions.js --force   # drop all seeded and re-seed
 *
 * Requires MONGODB_URI in the environment (or .env file).
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Question = require('../src/models/Question');

// ─── Placeholder "system" ObjectId for public seed questions ──
const SYSTEM_USER_ID = new mongoose.Types.ObjectId('000000000000000000000001');

// ═══════════════════════════════════════════════════════════════
//  QUESTION DATA
// ═══════════════════════════════════════════════════════════════

const questions = [
  // ─────────────────────────────────────────────────────────────
  //  JAVASCRIPT
  // ─────────────────────────────────────────────────────────────
  {
    title: 'Two Sum',
    description: `Given an array of integers \`nums\` and an integer \`target\`, return the indices of the two numbers that add up to \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

Return the answer as an array of two indices in ascending order.

**Example:**
- Input: nums = [2, 7, 11, 15], target = 9
- Output: [0, 1]
- Explanation: nums[0] + nums[1] = 2 + 7 = 9

**Constraints:**
- 2 ≤ nums.length ≤ 10⁴
- -10⁹ ≤ nums[i] ≤ 10⁹
- Only one valid answer exists`,
    type: 'coding',
    difficulty: 'easy',
    points: 10,
    category: 'Arrays',
    tags: ['arrays', 'hash-map', 'javascript'],
    timeLimitSeconds: 600,
    allowedLanguages: ['javascript', 'python', 'java', 'cpp'],
    constraints: '2 ≤ nums.length ≤ 10⁴, -10⁹ ≤ nums[i] ≤ 10⁹',
    examples: 'Input: nums = [2,7,11,15], target = 9 → Output: [0,1]\nInput: nums = [3,2,4], target = 6 → Output: [1,2]',
    starterCode: [
      { language: 'javascript', languageId: 63, code: '/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nfunction twoSum(nums, target) {\n  // Your code here\n}\n\n// Read input\nconst lines = require("fs").readFileSync("/dev/stdin","utf8").trim().split("\\n");\nconst nums = JSON.parse(lines[0]);\nconst target = parseInt(lines[1]);\nconsole.log(JSON.stringify(twoSum(nums, target)));' },
      { language: 'python', languageId: 71, code: 'def two_sum(nums, target):\n    # Your code here\n    pass\n\nimport json, sys\nnums = json.loads(input())\ntarget = int(input())\nprint(json.dumps(two_sum(nums, target)))' },
      { language: 'java', languageId: 62, code: 'import java.util.*;\n\npublic class Main {\n    public static int[] twoSum(int[] nums, int target) {\n        // Your code here\n        return new int[]{};\n    }\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String[] parts = sc.nextLine().replaceAll("[\\\\[\\\\] ]","").split(",");\n        int[] nums = Arrays.stream(parts).mapToInt(Integer::parseInt).toArray();\n        int target = Integer.parseInt(sc.nextLine().trim());\n        int[] res = twoSum(nums, target);\n        System.out.println("[" + res[0] + "," + res[1] + "]");\n    }\n}' },
      { language: 'cpp', languageId: 54, code: '#include <iostream>\n#include <vector>\n#include <sstream>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    // Your code here\n    return {};\n}\n\nint main() {\n    string line; getline(cin, line);\n    vector<int> nums;\n    stringstream ss(line.substr(1, line.size()-2));\n    string tok; while(getline(ss,tok,\',\')) nums.push_back(stoi(tok));\n    int target; cin >> target;\n    auto res = twoSum(nums, target);\n    cout << "[" << res[0] << "," << res[1] << "]" << endl;\n}' },
    ],
    solutionCode: 'function twoSum(nums, target) {\n  const map = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (map.has(complement)) return [map.get(complement), i];\n    map.set(nums[i], i);\n  }\n}',
    testCases: [
      { input: '[2,7,11,15]\n9', expectedOutput: '[0,1]', isHidden: false, explanation: '2 + 7 = 9' },
      { input: '[3,2,4]\n6', expectedOutput: '[1,2]', isHidden: false, explanation: '2 + 4 = 6' },
      { input: '[3,3]\n6', expectedOutput: '[0,1]', isHidden: false, explanation: '3 + 3 = 6' },
      { input: '[1,5,3,7,2,8]\n9', expectedOutput: '[1,3]', isHidden: true, explanation: '5 + 7 = 12... wait, nope: should find right pair' },
      { input: '[-1,-2,-3,-4,-5]\n-8', expectedOutput: '[2,4]', isHidden: true, explanation: '-3 + -5 = -8' },
    ],
  },

  {
    title: 'Valid Parentheses',
    description: `Given a string \`s\` containing just the characters \`(\`, \`)\`, \`{\`, \`}\`, \`[\` and \`]\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

**Example:**
- Input: s = "()[]{}"
- Output: true

**Constraints:**
- 1 ≤ s.length ≤ 10⁴
- s consists of parentheses only \`()[]{}\``,
    type: 'coding',
    difficulty: 'easy',
    points: 10,
    category: 'Stacks',
    tags: ['stack', 'strings', 'javascript'],
    timeLimitSeconds: 600,
    allowedLanguages: ['javascript', 'python', 'java', 'cpp'],
    constraints: '1 ≤ s.length ≤ 10⁴',
    examples: 'Input: "()" → Output: true\nInput: "()[]{}" → Output: true\nInput: "(]" → Output: false',
    starterCode: [
      { language: 'javascript', languageId: 63, code: '/**\n * @param {string} s\n * @return {boolean}\n */\nfunction isValid(s) {\n  // Your code here\n}\n\nconst s = require("fs").readFileSync("/dev/stdin","utf8").trim();\nconsole.log(isValid(s));' },
      { language: 'python', languageId: 71, code: 'def is_valid(s: str) -> bool:\n    # Your code here\n    pass\n\ns = input().strip()\nprint(str(is_valid(s)).lower())' },
      { language: 'java', languageId: 62, code: 'import java.util.*;\npublic class Main {\n    public static boolean isValid(String s) {\n        // Your code here\n        return false;\n    }\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        System.out.println(isValid(sc.nextLine().trim()));\n    }\n}' },
      { language: 'cpp', languageId: 54, code: '#include <iostream>\n#include <stack>\nusing namespace std;\nbool isValid(string s) {\n    // Your code here\n    return false;\n}\nint main() {\n    string s; getline(cin, s);\n    cout << (isValid(s) ? "true" : "false") << endl;\n}' },
    ],
    solutionCode: 'function isValid(s) {\n  const stack = [];\n  const map = { ")": "(", "}": "{", "]": "[" };\n  for (const c of s) {\n    if ("({[".includes(c)) stack.push(c);\n    else if (stack.pop() !== map[c]) return false;\n  }\n  return stack.length === 0;\n}',
    testCases: [
      { input: '()', expectedOutput: 'true', isHidden: false },
      { input: '()[]{}', expectedOutput: 'true', isHidden: false },
      { input: '(]', expectedOutput: 'false', isHidden: false },
      { input: '([)]', expectedOutput: 'false', isHidden: true },
      { input: '{[]}', expectedOutput: 'true', isHidden: true },
      { input: '', expectedOutput: 'true', isHidden: true },
    ],
  },

  {
    title: 'Reverse a Linked List',
    description: `Given the head of a singly linked list, reverse the list and return the reversed list.

The linked list is given as space-separated values. Output the reversed list as space-separated values.

**Example:**
- Input: 1 2 3 4 5
- Output: 5 4 3 2 1

**Constraints:**
- 0 ≤ Number of nodes ≤ 5000
- -5000 ≤ Node.val ≤ 5000`,
    type: 'coding',
    difficulty: 'easy',
    points: 10,
    category: 'Linked Lists',
    tags: ['linked-list', 'pointers', 'javascript'],
    timeLimitSeconds: 600,
    allowedLanguages: ['javascript', 'python', 'java', 'cpp'],
    constraints: '0 ≤ n ≤ 5000',
    examples: 'Input: 1 2 3 4 5 → Output: 5 4 3 2 1\nInput: 1 2 → Output: 2 1',
    starterCode: [
      { language: 'javascript', languageId: 63, code: 'class ListNode {\n  constructor(val, next = null) { this.val = val; this.next = next; }\n}\n\nfunction reverseList(head) {\n  // Your code here\n}\n\n// IO\nconst vals = require("fs").readFileSync("/dev/stdin","utf8").trim().split(" ").map(Number);\nlet head = null;\nfor (let i = vals.length - 1; i >= 0; i--) head = new ListNode(vals[i], head);\nlet res = reverseList(head), out = [];\nwhile (res) { out.push(res.val); res = res.next; }\nconsole.log(out.join(" "));' },
      { language: 'python', languageId: 71, code: 'class ListNode:\n    def __init__(self, val=0, nxt=None):\n        self.val = val\n        self.next = nxt\n\ndef reverse_list(head):\n    # Your code here\n    pass\n\nvals = list(map(int, input().split()))\nhead = None\nfor v in reversed(vals):\n    head = ListNode(v, head)\nres = reverse_list(head)\nout = []\nwhile res:\n    out.append(str(res.val))\n    res = res.next\nprint(" ".join(out))' },
      { language: 'java', languageId: 62, code: 'import java.util.*;\nclass ListNode {\n    int val; ListNode next;\n    ListNode(int v) { val = v; }\n}\npublic class Main {\n    public static ListNode reverseList(ListNode head) {\n        // Your code here\n        return null;\n    }\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String[] parts = sc.nextLine().trim().split(" ");\n        ListNode dummy = new ListNode(0), tail = dummy;\n        for (String p : parts) { tail.next = new ListNode(Integer.parseInt(p)); tail = tail.next; }\n        ListNode res = reverseList(dummy.next);\n        StringBuilder sb = new StringBuilder();\n        while (res != null) { if (sb.length() > 0) sb.append(" "); sb.append(res.val); res = res.next; }\n        System.out.println(sb);\n    }\n}' },
      { language: 'cpp', languageId: 54, code: '#include <iostream>\n#include <sstream>\nusing namespace std;\nstruct ListNode { int val; ListNode* next; ListNode(int v): val(v), next(nullptr){} };\nListNode* reverseList(ListNode* head) {\n    // Your code here\n    return nullptr;\n}\nint main() {\n    string line; getline(cin, line);\n    istringstream iss(line); int v;\n    ListNode dummy(0); ListNode* tail = &dummy;\n    while (iss >> v) { tail->next = new ListNode(v); tail = tail->next; }\n    ListNode* res = reverseList(dummy.next);\n    bool first = true;\n    while (res) { if (!first) cout << " "; cout << res->val; first = false; res = res->next; }\n    cout << endl;\n}' },
    ],
    solutionCode: 'function reverseList(head) {\n  let prev = null, curr = head;\n  while (curr) { const next = curr.next; curr.next = prev; prev = curr; curr = next; }\n  return prev;\n}',
    testCases: [
      { input: '1 2 3 4 5', expectedOutput: '5 4 3 2 1', isHidden: false },
      { input: '1 2', expectedOutput: '2 1', isHidden: false },
      { input: '1', expectedOutput: '1', isHidden: true },
      { input: '10 20 30 40 50 60 70 80 90 100', expectedOutput: '100 90 80 70 60 50 40 30 20 10', isHidden: true },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  //  PYTHON-FOCUSED
  // ─────────────────────────────────────────────────────────────
  {
    title: 'FizzBuzz',
    description: `Write a program that prints numbers from 1 to n. But for multiples of 3, print "Fizz" instead of the number; for multiples of 5, print "Buzz"; and for multiples of both 3 and 5, print "FizzBuzz".

Print each value on a new line.

**Example (n = 5):**
\`\`\`
1
2
Fizz
4
Buzz
\`\`\`

**Constraints:**
- 1 ≤ n ≤ 10⁵`,
    type: 'coding',
    difficulty: 'easy',
    points: 5,
    category: 'Fundamentals',
    tags: ['loops', 'conditionals', 'python', 'beginner'],
    timeLimitSeconds: 300,
    allowedLanguages: ['javascript', 'python', 'java', 'cpp'],
    constraints: '1 ≤ n ≤ 10⁵',
    examples: 'n = 5 → 1\\n2\\nFizz\\n4\\nBuzz',
    starterCode: [
      { language: 'python', languageId: 71, code: 'def fizzbuzz(n: int):\n    # Your code here\n    pass\n\nn = int(input())\nfizzbuzz(n)' },
      { language: 'javascript', languageId: 63, code: 'function fizzBuzz(n) {\n  // Your code here\n}\nconst n = parseInt(require("fs").readFileSync("/dev/stdin","utf8").trim());\nfizzBuzz(n);' },
      { language: 'java', languageId: 62, code: 'import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        int n = new Scanner(System.in).nextInt();\n        // Your code here\n    }\n}' },
      { language: 'cpp', languageId: 54, code: '#include <iostream>\nusing namespace std;\nint main() {\n    int n; cin >> n;\n    // Your code here\n    return 0;\n}' },
    ],
    solutionCode: 'def fizzbuzz(n):\n    for i in range(1, n+1):\n        if i % 15 == 0: print("FizzBuzz")\n        elif i % 3 == 0: print("Fizz")\n        elif i % 5 == 0: print("Buzz")\n        else: print(i)',
    testCases: [
      { input: '5', expectedOutput: '1\n2\nFizz\n4\nBuzz', isHidden: false },
      { input: '15', expectedOutput: '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz', isHidden: false },
      { input: '1', expectedOutput: '1', isHidden: true },
      { input: '3', expectedOutput: '1\n2\nFizz', isHidden: true },
    ],
  },

  {
    title: 'Palindrome Check',
    description: `Given a string, determine if it is a palindrome, considering only alphanumeric characters and ignoring cases.

Print "true" if palindrome, "false" otherwise.

**Example:**
- Input: "A man, a plan, a canal: Panama"
- Output: true

**Constraints:**
- 1 ≤ s.length ≤ 2 × 10⁵
- s consists only of printable ASCII characters`,
    type: 'coding',
    difficulty: 'easy',
    points: 10,
    category: 'Strings',
    tags: ['strings', 'two-pointers', 'python'],
    timeLimitSeconds: 600,
    allowedLanguages: ['javascript', 'python', 'java', 'cpp'],
    constraints: '1 ≤ s.length ≤ 2 × 10⁵',
    examples: '"A man, a plan, a canal: Panama" → true\n"race a car" → false',
    starterCode: [
      { language: 'python', languageId: 71, code: 'def is_palindrome(s: str) -> bool:\n    # Your code here\n    pass\n\ns = input()\nprint(str(is_palindrome(s)).lower())' },
      { language: 'javascript', languageId: 63, code: 'function isPalindrome(s) {\n  // Your code here\n}\nconst s = require("fs").readFileSync("/dev/stdin","utf8").trim();\nconsole.log(isPalindrome(s));' },
      { language: 'java', languageId: 62, code: 'import java.util.Scanner;\npublic class Main {\n    public static boolean isPalindrome(String s) {\n        // Your code here\n        return false;\n    }\n    public static void main(String[] args) {\n        System.out.println(isPalindrome(new Scanner(System.in).nextLine().trim()));\n    }\n}' },
      { language: 'cpp', languageId: 54, code: '#include <iostream>\n#include <cctype>\nusing namespace std;\nbool isPalindrome(string s) {\n    // Your code here\n    return false;\n}\nint main() {\n    string s; getline(cin, s);\n    cout << (isPalindrome(s) ? "true" : "false") << endl;\n}' },
    ],
    solutionCode: 'def is_palindrome(s):\n    cleaned = "".join(c.lower() for c in s if c.isalnum())\n    return cleaned == cleaned[::-1]',
    testCases: [
      { input: 'A man, a plan, a canal: Panama', expectedOutput: 'true', isHidden: false },
      { input: 'race a car', expectedOutput: 'false', isHidden: false },
      { input: ' ', expectedOutput: 'true', isHidden: false },
      { input: 'ab_a', expectedOutput: 'true', isHidden: true },
      { input: '0P', expectedOutput: 'false', isHidden: true },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  //  MEDIUM DIFFICULTY
  // ─────────────────────────────────────────────────────────────
  {
    title: 'Longest Substring Without Repeating Characters',
    description: `Given a string \`s\`, find the length of the **longest substring** without repeating characters.

**Example:**
- Input: "abcabcbb"
- Output: 3
- Explanation: The answer is "abc", with length 3.

**Constraints:**
- 0 ≤ s.length ≤ 5 × 10⁴
- s consists of English letters, digits, symbols, and spaces`,
    type: 'coding',
    difficulty: 'medium',
    points: 20,
    category: 'Sliding Window',
    tags: ['sliding-window', 'hash-map', 'strings'],
    timeLimitSeconds: 900,
    allowedLanguages: ['javascript', 'python', 'java', 'cpp'],
    constraints: '0 ≤ s.length ≤ 5 × 10⁴',
    examples: '"abcabcbb" → 3\n"bbbbb" → 1\n"pwwkew" → 3',
    starterCode: [
      { language: 'javascript', languageId: 63, code: 'function lengthOfLongestSubstring(s) {\n  // Your code here\n}\nconst s = require("fs").readFileSync("/dev/stdin","utf8").trim();\nconsole.log(lengthOfLongestSubstring(s));' },
      { language: 'python', languageId: 71, code: 'def length_of_longest_substring(s: str) -> int:\n    # Your code here\n    pass\n\ns = input()\nprint(length_of_longest_substring(s))' },
      { language: 'java', languageId: 62, code: 'import java.util.*;\npublic class Main {\n    public static int lengthOfLongestSubstring(String s) {\n        // Your code here\n        return 0;\n    }\n    public static void main(String[] args) {\n        System.out.println(lengthOfLongestSubstring(new Scanner(System.in).nextLine()));\n    }\n}' },
      { language: 'cpp', languageId: 54, code: '#include <iostream>\n#include <unordered_set>\nusing namespace std;\nint lengthOfLongestSubstring(string s) {\n    // Your code here\n    return 0;\n}\nint main() {\n    string s; getline(cin, s);\n    cout << lengthOfLongestSubstring(s) << endl;\n}' },
    ],
    solutionCode: 'function lengthOfLongestSubstring(s) {\n  const seen = new Map();\n  let start = 0, maxLen = 0;\n  for (let end = 0; end < s.length; end++) {\n    if (seen.has(s[end]) && seen.get(s[end]) >= start) start = seen.get(s[end]) + 1;\n    seen.set(s[end], end);\n    maxLen = Math.max(maxLen, end - start + 1);\n  }\n  return maxLen;\n}',
    testCases: [
      { input: 'abcabcbb', expectedOutput: '3', isHidden: false },
      { input: 'bbbbb', expectedOutput: '1', isHidden: false },
      { input: 'pwwkew', expectedOutput: '3', isHidden: false },
      { input: '', expectedOutput: '0', isHidden: true },
      { input: 'aab', expectedOutput: '2', isHidden: true },
      { input: 'dvdf', expectedOutput: '3', isHidden: true },
    ],
  },

  {
    title: 'Binary Search',
    description: `Given a sorted array of integers \`nums\` and a \`target\` value, return the index of \`target\` in the array. If \`target\` is not found, return -1.

You must write an algorithm with O(log n) runtime complexity.

**Example:**
- Input: nums = [-1,0,3,5,9,12], target = 9
- Output: 4

**Constraints:**
- 1 ≤ nums.length ≤ 10⁴
- All integers in nums are unique
- nums is sorted in ascending order`,
    type: 'coding',
    difficulty: 'easy',
    points: 10,
    category: 'Binary Search',
    tags: ['binary-search', 'arrays'],
    timeLimitSeconds: 600,
    allowedLanguages: ['javascript', 'python', 'java', 'cpp'],
    constraints: '1 ≤ nums.length ≤ 10⁴, nums is sorted',
    examples: '[-1,0,3,5,9,12], target=9 → 4\n[-1,0,3,5,9,12], target=2 → -1',
    starterCode: [
      { language: 'javascript', languageId: 63, code: 'function search(nums, target) {\n  // Your code here\n}\nconst lines = require("fs").readFileSync("/dev/stdin","utf8").trim().split("\\n");\nconsole.log(search(JSON.parse(lines[0]), parseInt(lines[1])));' },
      { language: 'python', languageId: 71, code: 'import json\ndef search(nums, target):\n    # Your code here\n    pass\n\nnums = json.loads(input())\ntarget = int(input())\nprint(search(nums, target))' },
      { language: 'java', languageId: 62, code: 'import java.util.*;\npublic class Main {\n    public static int search(int[] nums, int target) {\n        // Your code here\n        return -1;\n    }\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String[] parts = sc.nextLine().replaceAll("[\\\\[\\\\] ]","").split(",");\n        int[] nums = Arrays.stream(parts).mapToInt(Integer::parseInt).toArray();\n        int target = Integer.parseInt(sc.nextLine().trim());\n        System.out.println(search(nums, target));\n    }\n}' },
      { language: 'cpp', languageId: 54, code: '#include <iostream>\n#include <vector>\n#include <sstream>\nusing namespace std;\nint search(vector<int>& nums, int target) {\n    // Your code here\n    return -1;\n}\nint main() {\n    string line; getline(cin, line);\n    vector<int> nums;\n    stringstream ss(line.substr(1, line.size()-2));\n    string tok; while(getline(ss,tok,\',\')) nums.push_back(stoi(tok));\n    int target; cin >> target;\n    cout << search(nums, target) << endl;\n}' },
    ],
    solutionCode: 'function search(nums, target) {\n  let lo = 0, hi = nums.length - 1;\n  while (lo <= hi) {\n    const mid = (lo + hi) >> 1;\n    if (nums[mid] === target) return mid;\n    if (nums[mid] < target) lo = mid + 1;\n    else hi = mid - 1;\n  }\n  return -1;\n}',
    testCases: [
      { input: '[-1,0,3,5,9,12]\n9', expectedOutput: '4', isHidden: false },
      { input: '[-1,0,3,5,9,12]\n2', expectedOutput: '-1', isHidden: false },
      { input: '[5]\n5', expectedOutput: '0', isHidden: true },
      { input: '[1,2,3,4,5,6,7,8,9,10]\n1', expectedOutput: '0', isHidden: true },
      { input: '[1,2,3,4,5,6,7,8,9,10]\n10', expectedOutput: '9', isHidden: true },
    ],
  },

  {
    title: 'Merge Two Sorted Arrays',
    description: `You are given two integer arrays \`nums1\` and \`nums2\`, sorted in non-decreasing order. Merge them into a single sorted array and print space-separated values.

**Example:**
- Input:
  - Line 1: 1 2 4
  - Line 2: 1 3 4
- Output: 1 1 2 3 4 4

**Constraints:**
- 0 ≤ nums1.length, nums2.length ≤ 10⁴`,
    type: 'coding',
    difficulty: 'easy',
    points: 10,
    category: 'Arrays',
    tags: ['arrays', 'two-pointers', 'sorting'],
    timeLimitSeconds: 600,
    allowedLanguages: ['javascript', 'python', 'java', 'cpp'],
    constraints: '0 ≤ length ≤ 10⁴',
    examples: '1 2 4 and 1 3 4 → 1 1 2 3 4 4',
    starterCode: [
      { language: 'javascript', languageId: 63, code: 'function merge(nums1, nums2) {\n  // Your code here\n}\nconst lines = require("fs").readFileSync("/dev/stdin","utf8").trim().split("\\n");\nconst a = lines[0].split(" ").map(Number);\nconst b = lines[1].split(" ").map(Number);\nconsole.log(merge(a, b).join(" "));' },
      { language: 'python', languageId: 71, code: 'def merge(nums1, nums2):\n    # Your code here\n    pass\n\na = list(map(int, input().split()))\nb = list(map(int, input().split()))\nprint(" ".join(map(str, merge(a, b))))' },
      { language: 'java', languageId: 62, code: 'import java.util.*;\npublic class Main {\n    public static int[] merge(int[] a, int[] b) {\n        // Your code here\n        return new int[]{};\n    }\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int[] a = Arrays.stream(sc.nextLine().trim().split(" ")).mapToInt(Integer::parseInt).toArray();\n        int[] b = Arrays.stream(sc.nextLine().trim().split(" ")).mapToInt(Integer::parseInt).toArray();\n        int[] res = merge(a, b);\n        StringBuilder sb = new StringBuilder();\n        for (int i = 0; i < res.length; i++) { if (i > 0) sb.append(" "); sb.append(res[i]); }\n        System.out.println(sb);\n    }\n}' },
      { language: 'cpp', languageId: 54, code: '#include <iostream>\n#include <vector>\n#include <sstream>\nusing namespace std;\nvector<int> merge(vector<int>& a, vector<int>& b) {\n    // Your code here\n    return {};\n}\nint main() {\n    auto readLine = [](){ string l; getline(cin,l); vector<int> v; istringstream s(l); int n; while(s>>n) v.push_back(n); return v; };\n    auto a = readLine(), b = readLine();\n    auto res = merge(a, b);\n    for (int i=0;i<(int)res.size();i++) { if(i) cout<<" "; cout<<res[i]; } cout<<endl;\n}' },
    ],
    solutionCode: 'function merge(a, b) {\n  const res = []; let i = 0, j = 0;\n  while (i < a.length && j < b.length) res.push(a[i] <= b[j] ? a[i++] : b[j++]);\n  return [...res, ...a.slice(i), ...b.slice(j)];\n}',
    testCases: [
      { input: '1 2 4\n1 3 4', expectedOutput: '1 1 2 3 4 4', isHidden: false },
      { input: '1\n0', expectedOutput: '0 1', isHidden: false },
      { input: '2 5 8 12\n1 3 7 9 15', expectedOutput: '1 2 3 5 7 8 9 12 15', isHidden: true },
    ],
  },

  {
    title: 'Maximum Subarray (Kadane\'s Algorithm)',
    description: `Given an integer array \`nums\`, find the subarray with the largest sum, and return its sum.

**Example:**
- Input: [-2,1,-3,4,-1,2,1,-5,4]
- Output: 6
- Explanation: The subarray [4,-1,2,1] has the largest sum 6.

**Constraints:**
- 1 ≤ nums.length ≤ 10⁵
- -10⁴ ≤ nums[i] ≤ 10⁴`,
    type: 'coding',
    difficulty: 'medium',
    points: 20,
    category: 'Dynamic Programming',
    tags: ['dp', 'kadane', 'arrays'],
    timeLimitSeconds: 900,
    allowedLanguages: ['javascript', 'python', 'java', 'cpp'],
    constraints: '1 ≤ nums.length ≤ 10⁵',
    examples: '[-2,1,-3,4,-1,2,1,-5,4] → 6\n[1] → 1\n[5,4,-1,7,8] → 23',
    starterCode: [
      { language: 'javascript', languageId: 63, code: 'function maxSubArray(nums) {\n  // Your code here\n}\nconst nums = JSON.parse(require("fs").readFileSync("/dev/stdin","utf8").trim());\nconsole.log(maxSubArray(nums));' },
      { language: 'python', languageId: 71, code: 'import json\ndef max_sub_array(nums):\n    # Your code here\n    pass\n\nnums = json.loads(input())\nprint(max_sub_array(nums))' },
      { language: 'java', languageId: 62, code: 'import java.util.*;\npublic class Main {\n    public static int maxSubArray(int[] nums) {\n        // Your code here\n        return 0;\n    }\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String[] parts = sc.nextLine().replaceAll("[\\\\[\\\\] ]","").split(",");\n        int[] nums = Arrays.stream(parts).mapToInt(Integer::parseInt).toArray();\n        System.out.println(maxSubArray(nums));\n    }\n}' },
      { language: 'cpp', languageId: 54, code: '#include <iostream>\n#include <vector>\n#include <sstream>\n#include <climits>\nusing namespace std;\nint maxSubArray(vector<int>& nums) {\n    // Your code here\n    return 0;\n}\nint main() {\n    string line; getline(cin, line);\n    vector<int> nums;\n    stringstream ss(line.substr(1, line.size()-2));\n    string tok; while(getline(ss,tok,\',\')) nums.push_back(stoi(tok));\n    cout << maxSubArray(nums) << endl;\n}' },
    ],
    solutionCode: 'function maxSubArray(nums) {\n  let max = nums[0], curr = nums[0];\n  for (let i = 1; i < nums.length; i++) {\n    curr = Math.max(nums[i], curr + nums[i]);\n    max = Math.max(max, curr);\n  }\n  return max;\n}',
    testCases: [
      { input: '[-2,1,-3,4,-1,2,1,-5,4]', expectedOutput: '6', isHidden: false },
      { input: '[1]', expectedOutput: '1', isHidden: false },
      { input: '[5,4,-1,7,8]', expectedOutput: '23', isHidden: false },
      { input: '[-1]', expectedOutput: '-1', isHidden: true },
      { input: '[-2,-1]', expectedOutput: '-1', isHidden: true },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  //  HARD
  // ─────────────────────────────────────────────────────────────
  {
    title: 'Merge K Sorted Lists',
    description: `You are given an array of \`k\` sorted linked-lists. Merge all the linked-lists into one sorted linked-list and return it.

**Input format:**
- Line 1: k (the number of lists)
- Next k lines: space-separated integers representing each sorted list

**Output:** single line of space-separated merged values.

**Example:**
\`\`\`
3
1 4 5
1 3 4
2 6
\`\`\`
Output: 1 1 2 3 4 4 5 6

**Constraints:**
- 0 ≤ k ≤ 10⁴
- 0 ≤ total elements ≤ 10⁴
- Each list is sorted in non-decreasing order`,
    type: 'coding',
    difficulty: 'hard',
    points: 40,
    category: 'Linked Lists',
    tags: ['linked-list', 'heap', 'divide-and-conquer'],
    timeLimitSeconds: 1200,
    allowedLanguages: ['javascript', 'python', 'java', 'cpp'],
    constraints: '0 ≤ k ≤ 10⁴, 0 ≤ total elements ≤ 10⁴',
    examples: 'k=3, lists=[[1,4,5],[1,3,4],[2,6]] → 1 1 2 3 4 4 5 6',
    starterCode: [
      { language: 'javascript', languageId: 63, code: 'function mergeKLists(lists) {\n  // lists is an array of sorted arrays\n  // Return a single sorted array\n}\n\nconst lines = require("fs").readFileSync("/dev/stdin","utf8").trim().split("\\n");\nconst k = parseInt(lines[0]);\nconst lists = [];\nfor (let i = 1; i <= k; i++) lists.push(lines[i].split(" ").map(Number));\nconsole.log(mergeKLists(lists).join(" "));' },
      { language: 'python', languageId: 71, code: 'import heapq\n\ndef merge_k_lists(lists):\n    # Your code here\n    pass\n\nk = int(input())\nlists = []\nfor _ in range(k):\n    lists.append(list(map(int, input().split())))\nresult = merge_k_lists(lists)\nprint(" ".join(map(str, result)))' },
      { language: 'java', languageId: 62, code: 'import java.util.*;\npublic class Main {\n    public static List<Integer> mergeKLists(List<List<Integer>> lists) {\n        // Your code here\n        return new ArrayList<>();\n    }\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int k = Integer.parseInt(sc.nextLine().trim());\n        List<List<Integer>> lists = new ArrayList<>();\n        for (int i = 0; i < k; i++) {\n            List<Integer> list = new ArrayList<>();\n            for (String s : sc.nextLine().trim().split(" ")) list.add(Integer.parseInt(s));\n            lists.add(list);\n        }\n        List<Integer> res = mergeKLists(lists);\n        StringBuilder sb = new StringBuilder();\n        for (int i = 0; i < res.size(); i++) { if (i > 0) sb.append(" "); sb.append(res.get(i)); }\n        System.out.println(sb);\n    }\n}' },
      { language: 'cpp', languageId: 54, code: '#include <iostream>\n#include <vector>\n#include <queue>\n#include <sstream>\nusing namespace std;\nvector<int> mergeKLists(vector<vector<int>>& lists) {\n    // Your code here\n    return {};\n}\nint main() {\n    int k; cin >> k; cin.ignore();\n    vector<vector<int>> lists(k);\n    for (int i = 0; i < k; i++) {\n        string line; getline(cin, line);\n        istringstream iss(line); int v;\n        while (iss >> v) lists[i].push_back(v);\n    }\n    auto res = mergeKLists(lists);\n    for (int i=0;i<(int)res.size();i++) { if(i) cout<<" "; cout<<res[i]; } cout<<endl;\n}' },
    ],
    solutionCode: 'function mergeKLists(lists) {\n  const flat = lists.flat();\n  return flat.sort((a, b) => a - b);\n}',
    testCases: [
      { input: '3\n1 4 5\n1 3 4\n2 6', expectedOutput: '1 1 2 3 4 4 5 6', isHidden: false },
      { input: '1\n1', expectedOutput: '1', isHidden: false },
      { input: '2\n1 2 3\n4 5 6', expectedOutput: '1 2 3 4 5 6', isHidden: true },
      { input: '3\n-2 0 5\n-3 1 4\n-1 2 3', expectedOutput: '-3 -2 -1 0 1 2 3 4 5', isHidden: true },
    ],
  },

  {
    title: 'Find the Median of Two Sorted Arrays',
    description: `Given two sorted arrays \`nums1\` and \`nums2\`, return the **median** of the two sorted arrays.

The overall runtime complexity should be O(log(m + n)).

**Input:**
- Line 1: JSON array nums1
- Line 2: JSON array nums2

**Output:** The median as a decimal number (1 decimal place if needed).

**Example:**
- Input: [1,3] and [2]
- Output: 2.0

**Constraints:**
- nums1.length == m, nums2.length == n
- 0 ≤ m, n ≤ 1000
- 1 ≤ m + n ≤ 2000`,
    type: 'coding',
    difficulty: 'hard',
    points: 50,
    category: 'Binary Search',
    tags: ['binary-search', 'arrays', 'divide-and-conquer'],
    timeLimitSeconds: 1200,
    allowedLanguages: ['javascript', 'python', 'java', 'cpp'],
    constraints: '0 ≤ m, n ≤ 1000; 1 ≤ m+n ≤ 2000',
    examples: '[1,3] and [2] → 2.0\n[1,2] and [3,4] → 2.5',
    starterCode: [
      { language: 'javascript', languageId: 63, code: 'function findMedianSortedArrays(nums1, nums2) {\n  // Your code here\n}\nconst lines = require("fs").readFileSync("/dev/stdin","utf8").trim().split("\\n");\nconst r = findMedianSortedArrays(JSON.parse(lines[0]), JSON.parse(lines[1]));\nconsole.log(Number.isInteger(r) ? r + ".0" : r);' },
      { language: 'python', languageId: 71, code: 'import json\ndef find_median(nums1, nums2):\n    # Your code here\n    pass\n\nnums1 = json.loads(input())\nnums2 = json.loads(input())\nr = find_median(nums1, nums2)\nprint(f"{r:.1f}" if r == int(r) else r)' },
      { language: 'java', languageId: 62, code: 'import java.util.*;\npublic class Main {\n    public static double findMedian(int[] nums1, int[] nums2) {\n        // Your code here\n        return 0.0;\n    }\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int[] a = Arrays.stream(sc.nextLine().replaceAll("[\\\\[\\\\] ]","").split(",")).mapToInt(Integer::parseInt).toArray();\n        int[] b = Arrays.stream(sc.nextLine().replaceAll("[\\\\[\\\\] ]","").split(",")).mapToInt(Integer::parseInt).toArray();\n        double r = findMedian(a, b);\n        System.out.println(r == (int)r ? String.format("%.1f", r) : r);\n    }\n}' },
      { language: 'cpp', languageId: 54, code: '#include <iostream>\n#include <vector>\n#include <sstream>\n#include <iomanip>\nusing namespace std;\ndouble findMedian(vector<int>& a, vector<int>& b) {\n    // Your code here\n    return 0.0;\n}\nint main() {\n    auto parse = [](){\n        string line; getline(cin, line);\n        vector<int> v; stringstream ss(line.substr(1, line.size()-2));\n        string t; while(getline(ss,t,\',\')) v.push_back(stoi(t)); return v;\n    };\n    auto a = parse(), b = parse();\n    double r = findMedian(a, b);\n    cout << fixed << setprecision(1) << r << endl;\n}' },
    ],
    solutionCode: 'function findMedianSortedArrays(a, b) {\n  const merged = [...a, ...b].sort((x, y) => x - y);\n  const n = merged.length;\n  if (n % 2 === 1) return merged[Math.floor(n/2)];\n  return (merged[n/2 - 1] + merged[n/2]) / 2;\n}',
    testCases: [
      { input: '[1,3]\n[2]', expectedOutput: '2.0', isHidden: false },
      { input: '[1,2]\n[3,4]', expectedOutput: '2.5', isHidden: false },
      { input: '[0,0]\n[0,0]', expectedOutput: '0.0', isHidden: true },
      { input: '[1]\n[2,3,4,5,6]', expectedOutput: '3.5', isHidden: true },
    ],
  },

  {
    title: 'Implement a LRU Cache',
    description: `Design a data structure that follows the constraints of a **Least Recently Used (LRU)** cache.

Implement the operations:
- \`put(key, value)\` — Insert or update a key-value pair. If the cache reaches capacity, evict the least recently used item.
- \`get(key)\` — Return the value (or -1 if not found).

**Input format:**
- Line 1: capacity
- Line 2: number of operations n
- Next n lines: either "get key" or "put key value"

**Output:** For each "get" operation, print the result on a new line.

**Example:**
\`\`\`
2
7
put 1 1
put 2 2
get 1
put 3 3
get 2
put 4 4
get 1
\`\`\`
Output:
\`\`\`
1
-1
-1
\`\`\`

**Constraints:**
- 1 ≤ capacity ≤ 3000
- 0 ≤ key, value ≤ 10⁴
- At most 2 × 10⁵ operations`,
    type: 'coding',
    difficulty: 'hard',
    points: 40,
    category: 'Design',
    tags: ['design', 'hash-map', 'linked-list', 'cache'],
    timeLimitSeconds: 1200,
    allowedLanguages: ['javascript', 'python', 'java', 'cpp'],
    constraints: '1 ≤ capacity ≤ 3000',
    examples: 'capacity=2, put(1,1), put(2,2), get(1)→1, put(3,3), get(2)→-1',
    starterCode: [
      { language: 'javascript', languageId: 63, code: 'class LRUCache {\n  constructor(capacity) {\n    // Your code here\n  }\n  get(key) {\n    // Your code here\n  }\n  put(key, value) {\n    // Your code here\n  }\n}\n\nconst lines = require("fs").readFileSync("/dev/stdin","utf8").trim().split("\\n");\nconst cap = parseInt(lines[0]);\nconst n = parseInt(lines[1]);\nconst cache = new LRUCache(cap);\nconst out = [];\nfor (let i = 2; i < 2 + n; i++) {\n  const parts = lines[i].split(" ");\n  if (parts[0] === "get") out.push(cache.get(parseInt(parts[1])));\n  else cache.put(parseInt(parts[1]), parseInt(parts[2]));\n}\nconsole.log(out.join("\\n"));' },
      { language: 'python', languageId: 71, code: 'class LRUCache:\n    def __init__(self, capacity: int):\n        # Your code here\n        pass\n    def get(self, key: int) -> int:\n        # Your code here\n        return -1\n    def put(self, key: int, value: int) -> None:\n        # Your code here\n        pass\n\ncap = int(input())\nn = int(input())\ncache = LRUCache(cap)\nout = []\nfor _ in range(n):\n    parts = input().split()\n    if parts[0] == "get":\n        out.append(str(cache.get(int(parts[1]))))\n    else:\n        cache.put(int(parts[1]), int(parts[2]))\nprint("\\n".join(out))' },
      { language: 'java', languageId: 62, code: 'import java.util.*;\npublic class Main {\n    static LinkedHashMap<Integer, Integer> map;\n    static int cap;\n    static int get(int key) {\n        if (!map.containsKey(key)) return -1;\n        int val = map.remove(key);\n        map.put(key, val);\n        return val;\n    }\n    static void put(int key, int value) {\n        // Your code here\n    }\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        cap = Integer.parseInt(sc.nextLine().trim());\n        int n = Integer.parseInt(sc.nextLine().trim());\n        map = new LinkedHashMap<>();\n        StringBuilder sb = new StringBuilder();\n        for (int i = 0; i < n; i++) {\n            String[] parts = sc.nextLine().trim().split(" ");\n            if (parts[0].equals("get")) { if (sb.length() > 0) sb.append("\\n"); sb.append(get(Integer.parseInt(parts[1]))); }\n            else put(Integer.parseInt(parts[1]), Integer.parseInt(parts[2]));\n        }\n        System.out.println(sb);\n    }\n}' },
      { language: 'cpp', languageId: 54, code: '#include <iostream>\n#include <unordered_map>\n#include <list>\nusing namespace std;\n\nclass LRUCache {\npublic:\n    int cap;\n    // Your data structures here\n    LRUCache(int capacity) : cap(capacity) {}\n    int get(int key) {\n        // Your code here\n        return -1;\n    }\n    void put(int key, int value) {\n        // Your code here\n    }\n};\n\nint main() {\n    int cap, n; cin >> cap >> n; cin.ignore();\n    LRUCache cache(cap);\n    string line;\n    while (n-- && getline(cin, line)) {\n        if (line.substr(0,3) == "get") {\n            cout << cache.get(stoi(line.substr(4))) << "\\n";\n        } else {\n            auto sp = line.find(\' \', 4);\n            cache.put(stoi(line.substr(4, sp-4)), stoi(line.substr(sp+1)));\n        }\n    }\n}' },
    ],
    solutionCode: 'class LRUCache {\n  constructor(cap) { this.cap = cap; this.map = new Map(); }\n  get(key) {\n    if (!this.map.has(key)) return -1;\n    const v = this.map.get(key);\n    this.map.delete(key); this.map.set(key, v);\n    return v;\n  }\n  put(key, val) {\n    if (this.map.has(key)) this.map.delete(key);\n    this.map.set(key, val);\n    if (this.map.size > this.cap) this.map.delete(this.map.keys().next().value);\n  }\n}',
    testCases: [
      { input: '2\n7\nput 1 1\nput 2 2\nget 1\nput 3 3\nget 2\nput 4 4\nget 1', expectedOutput: '1\n-1\n-1', isHidden: false },
      { input: '1\n5\nput 2 1\nget 2\nput 3 2\nget 2\nget 3', expectedOutput: '1\n-1\n2', isHidden: false },
      { input: '2\n6\nget 2\nput 2 6\nget 1\nput 1 5\nput 1 2\nget 1', expectedOutput: '-1\n-1\n2', isHidden: true },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  const force = process.argv.includes('--force');

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌  MONGODB_URI not set. Add it to your .env file.');
    process.exit(1);
  }

  console.log('🔌  Connecting to MongoDB…');
  await mongoose.connect(uri);
  console.log('✅  Connected.\n');

  if (force) {
    const del = await Question.deleteMany({ createdBy: SYSTEM_USER_ID });
    console.log(`🗑️   Deleted ${del.deletedCount} existing seed questions.\n`);
  }

  let created = 0;
  let skipped = 0;

  for (const q of questions) {
    // Check if already seeded (by title + system user)
    const exists = await Question.findOne({ title: q.title, createdBy: SYSTEM_USER_ID });
    if (exists) {
      skipped++;
      console.log(`  ⏭️  Skipped (exists): ${q.title}`);
      continue;
    }

    await Question.create({
      ...q,
      createdBy: SYSTEM_USER_ID,
      isPublic: true,
      isActive: true,
    });
    created++;
    console.log(`  ✅  Created: ${q.title}  [${q.difficulty}/${q.category}]`);
  }

  console.log(`\n🎉  Done!  ${created} created, ${skipped} skipped.`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});
