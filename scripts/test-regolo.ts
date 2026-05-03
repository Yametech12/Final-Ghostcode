/**
 * Test Regolo AI connectivity and models
 */
import { createCompletion } from '../api/config.js';
import * as dotenv from 'dotenv';
dotenv.config();

async function testRegolo() {
  console.log('\n🤖 Testing Regolo AI Connection\n');
  console.log('='.repeat(50));
  
  try {
    console.log('1️⃣ Testing simple completion...');
    
    const response = await createCompletion({
      model: 'Llama-3.3-70B-Instruct',
      messages: [
        { role: 'user', content: 'Say "Hello from Regolo AI!" in exactly 5 words.' }
      ],
      temperature: 0.7,
      max_tokens: 50
    });
    
    console.log('✅ Regolo AI responded successfully!');
    console.log('\nResponse:', JSON.stringify(response, null, 2));
    
  } catch (error: any) {
    console.error('❌ Regolo AI test failed:', error.message);
    console.error('\nFull error:', error);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✨ Test Complete!\n');
}

testRegolo().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});