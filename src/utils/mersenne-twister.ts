/*
  I've wrapped Makoto Matsumoto and Takuji Nishimura's code in a namespace
  so it's better encapsulated. Now you can have multiple random number generators
  and they won't stomp all over eachother's state.

  If you want to use this as a substitute for Math.random(), use the random()
  method like so:

  var m = new MersenneTwister();
  var randomNumber = m.random();

  You can also call the other genrand_{foo}() methods on the instance.

  If you want to use a specific seed in order to get a repeatable random
  sequence, pass an integer into the constructor:

  var m = new MersenneTwister(123);

  and that will always produce the same random sequence.

  Sean McCullough (banksean@gmail.com)
*/

/*
   A C-program for MT19937, with initialization improved 2002/1/26.
   Coded by Takuji Nishimura and Makoto Matsumoto.

   Before using, initialize the state by using init_genrand(seed)
   or init_by_array(init_key, key_length).

   Copyright (C) 1997 - 2002, Makoto Matsumoto and Takuji Nishimura,
   All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions
   are met:

     1. Redistributions of source code must retain the above copyright
        notice, this list of conditions and the following disclaimer.

     2. Redistributions in binary form must reproduce the above copyright
        notice, this list of conditions and the following disclaimer in the
        documentation and/or other materials provided with the distribution.

     3. The names of its contributors may not be used to endorse or promote
        products derived from this software without specific prior written
        permission.

   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
   "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
   LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
   A PARTICULAR PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR
   CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
   EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
   PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
   PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
   SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.


   Any feedback is very welcome.
   http://www.math.sci.hiroshima-u.ac.jp/~m-mat/MT/emt.html
   email: m-mat @ math.sci.hiroshima-u.ac.jp (remove space)
*/
export class MersenneTwister {
	private readonly N = 624; /* period parameters */
	private readonly M = 397;
	private readonly MATRIX_A = 0x9908b0df; /* constant vector a */
	private readonly UPPER_MASK = 0x80000000; /* most significant w-r bits */
	private readonly LOWER_MASK = 0x7fffffff; /* least significant r bits */

	private readonly mt: number[] = new Array<number>(this.N); /* the array for the state vector */
	private mti = this.N + 1; /* mti==N+1 means mt[N] is not initialized */

	constructor(seed?: number) {
		if (seed === undefined) {
			seed = new Date().getTime();
		}
		this.init_genrand(seed);
	}

	init_genrand(seed: number): void {
		this.mt[0] = seed >>> 0;
		for (this.mti = 1; this.mti < this.N; this.mti++) {
			const s = this.mt[this.mti - 1]! ^ (this.mt[this.mti - 1]! >>> 30);
			this.mt[this.mti] = (((((s & 0xffff0000) >>> 16) * 1812433253) << 16) + (s & 0x0000ffff) * 1812433253)
				+ this.mti;
			this.mt[this.mti] = this.mt[this.mti]! >>> 0;
		}
	}

	init_by_array(init_key: number[], key_length: number): void {
		let i: number;
		let j: number;
		let k: number;
		this.init_genrand(19650218);
		i = 1;
		j = 0;
		k = (this.N > key_length ? this.N : key_length);
		for (; k; k--) {
			const s = this.mt[i - 1]! ^ (this.mt[i - 1]! >>> 30);
			this.mt[i] = (this.mt[i]! ^ (((((s & 0xffff0000) >>> 16) * 1664525) << 16) + ((s & 0x0000ffff) * 1664525)))
				+ init_key[j]! + j; /* non linear */
			this.mt[i] = this.mt[i]! >>> 0; /* for WORDSIZE > 32 machines */
			i++;
			j++;
			if (i >= this.N) {
				this.mt[0] = this.mt[this.N - 1]!;
				i = 1;
			}
			if (j >= key_length) j = 0;
		}
		for (k = this.N - 1; k; k--) {
			const s = this.mt[i - 1]! ^ (this.mt[i - 1]! >>> 30);
			this.mt[i] = (this.mt[i]! ^ (((((s & 0xffff0000) >>> 16) * 1566083941) << 16) + (s & 0x0000ffff) * 1566083941))
				- i; /* non linear */
			this.mt[i] = this.mt[i]! >>> 0; /* for WORDSIZE > 32 machines */
			i++;
			if (i >= this.N) {
				this.mt[0] = this.mt[this.N - 1]!;
				i = 1;
			}
		}

		this.mt[0] = 0x80000000; /* MSB is 1; assuring non-zero initial array */
	}

	/* generates a random number on [0,0xffffffff]-interval */
	randomInt(): number {
		let y: number;

		if (this.mti >= this.N) { /* generate N words at one time */
			let kk: number;

			if (this.mti == this.N + 1) this.init_genrand(5489);

			for (kk = 0; kk < this.N - this.M; kk++) {
				y = (this.mt[kk]! & this.UPPER_MASK) | (this.mt[kk + 1]! & this.LOWER_MASK);
				this.mt[kk] = this.mt[kk + this.M]! ^ (y >>> 1) ^ ((y & 0x1) ? this.MATRIX_A : 0);
			}
			for (; kk < this.N - 1; kk++) {
				y = (this.mt[kk]! & this.UPPER_MASK) | (this.mt[kk + 1]! & this.LOWER_MASK);
				this.mt[kk] = this.mt[kk + (this.M - this.N)]! ^ (y >>> 1) ^ ((y & 0x1) ? this.MATRIX_A : 0);
			}
			y = (this.mt[this.N - 1]! & this.UPPER_MASK) | (this.mt[0]! & this.LOWER_MASK);
			this.mt[this.N - 1] = this.mt[this.M - 1]! ^ (y >>> 1) ^ ((y & 0x1) ? this.MATRIX_A : 0);

			this.mti = 0;
		}

		y = this.mt[this.mti++]!;

		/* Tempering */
		y ^= (y >>> 11);
		y ^= (y << 7) & 0x9d2c5680;
		y ^= (y << 15) & 0xefc60000;
		y ^= (y >>> 18);

		return y >>> 0;
	}

	/* generates a random number on [0,0x7fffffff]-interval */
	genrand_int31(): number {
		return (this.randomInt() >>> 1);
	}

	/* generates a random number on [0,1]-real-interval */
	genrand_real1(): number {
		return this.randomInt() * (1.0 / 4294967295.0);
	}

	/* generates a random number on [0,1)-real-interval */
	random(): number {
		return this.randomInt() * (1.0 / 4294967296.0);
	}

	/* generates a random number on (0,1)-real-interval */
	genrand_real3(): number {
		return (this.randomInt() + 0.5) * (1.0 / 4294967296.0);
	}

	/* generates a random number on [0,1) with 53-bit resolution*/
	genrand_res53(): number {
		const a = this.randomInt() >>> 5;
		const b = this.randomInt() >>> 6;
		return (a * 67108864.0 + b) * (1.0 / 9007199254740992.0);
	}

}
